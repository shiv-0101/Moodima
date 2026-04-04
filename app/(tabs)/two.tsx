import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '@/components/Themed';
import { subscribeMoodEntriesUpdated } from '@/lib/moodEntriesBus';
import { supabase } from '@/lib/supabase';

type HeatmapEntry = {
  id: string;
  created_at: string;
  mood_score: number;
};

const LEVEL_COLORS = ['#e5e7eb', '#bfdbfe', '#60a5fa', '#2563eb', '#1d4ed8'];

const moodToLevel = (score: number) => {
  if (score < 2) return 0;
  if (score < 4) return 1;
  if (score < 6.5) return 2;
  if (score < 8.5) return 3;
  return 4;
};

export default function HeatmapScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<HeatmapEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const last28DayKeys = useMemo(() => {
    const keys: string[] = [];
    const today = new Date();

    for (let i = 27; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(today.getDate() - i);
      keys.push(date.toISOString().slice(0, 10));
    }

    return keys;
  }, []);

  const loadEntries = useCallback(async () => {
    setErrorMsg('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        setEntries([]);
        return;
      }

      const sinceDate = new Date();
      sinceDate.setHours(0, 0, 0, 0);
      sinceDate.setDate(sinceDate.getDate() - 27);

      const { data, error } = await supabase
        .from('mood_entries')
        .select('id, created_at, mood_score')
        .eq('user_id', userId)
        .gte('created_at', sinceDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setEntries((data as HeatmapEntry[]) ?? []);
    } catch {
      setErrorMsg('Failed to load heatmap data. Pull to retry.');
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEntries();
    }, [loadEntries])
  );

  useEffect(() => {
    const unsubscribe = subscribeMoodEntriesUpdated(() => {
      void loadEntries();
    });

    return unsubscribe;
  }, [loadEntries]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  };

  const latestByDay = useMemo(() => {
    const byDay = new Map<string, HeatmapEntry>();

    for (const entry of entries) {
      const dayKey = new Date(entry.created_at).toISOString().slice(0, 10);
      if (!byDay.has(dayKey)) {
        byDay.set(dayKey, entry);
      }
    }

    return byDay;
  }, [entries]);

  const cells: Array<HeatmapEntry | null> = useMemo(
    () => last28DayKeys.map((dayKey) => latestByDay.get(dayKey) ?? null),
    [last28DayKeys, latestByDay]
  );

  const weeklyBars = useMemo(() => {
    const days: Array<{ key: string; label: string }> = [];
    const today = new Date();

    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(today.getDate() - i);
      days.push({
        key: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      });
    }

    return days.map((day) => {
      const dayEntries = entries.filter(
        (entry) => new Date(entry.created_at).toISOString().slice(0, 10) === day.key
      );

      const average =
        dayEntries.length === 0
          ? 0
          : dayEntries.reduce((sum, entry) => sum + entry.mood_score, 0) / dayEntries.length;

      return {
        label: day.label,
        value: average,
      };
    });
  }, [entries]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Heatmap</Text>
      <Text style={styles.subtitle}>Last 28 check-ins by mood intensity</Text>

      {!!errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      {isInitialLoading ? (
        <View style={styles.skeletonWrap}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonGrid}>
            {Array.from({ length: 28 }, (_, idx) => (
              <View key={idx} style={styles.skeletonCell} />
            ))}
          </View>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.empty}>No entries yet. Record your first check-in.</Text>
          <Pressable style={styles.ctaButton} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.ctaButtonText}>Go To Record</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {cells.map((entry, idx) => {
              const level = entry ? moodToLevel(entry.mood_score) : 0;
              return <View key={idx} style={[styles.cell, { backgroundColor: LEVEL_COLORS[level] }]} />;
            })}
          </View>

          <View style={styles.legend}>
            <Text style={styles.legendText}>Low</Text>
            <View style={styles.legendScale}>
              {LEVEL_COLORS.map((c, i) => (
                <View key={i} style={[styles.legendCell, { backgroundColor: c }]} />
              ))}
            </View>
            <Text style={styles.legendText}>High</Text>
          </View>

          <View style={styles.weeklyWrap}>
            <Text style={styles.weeklyTitle}>Weekly Mood Average</Text>
            {weeklyBars.map((bar, idx) => (
              <View key={idx} style={styles.weeklyRow}>
                <Text style={styles.weeklyLabel}>{bar.label}</Text>
                <View style={styles.weeklyBarTrack}>
                  <View style={[styles.weeklyBarFill, { width: `${Math.max(0, Math.min(100, bar.value * 10))}%` }]} />
                </View>
                <Text style={styles.weeklyValue}>{bar.value.toFixed(1)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 14,
    opacity: 0.75,
  },
  error: {
    color: '#dc2626',
    marginBottom: 10,
  },
  emptyWrap: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  empty: {
    opacity: 0.8,
  },
  ctaButton: {
    marginTop: 10,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  ctaButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  skeletonWrap: {
    marginTop: 4,
  },
  skeletonTitle: {
    height: 14,
    width: '50%',
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    marginBottom: 12,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skeletonCell: {
    width: '12%',
    aspectRatio: 1,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: '12%',
    aspectRatio: 1,
    borderRadius: 6,
  },
  legend: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendScale: {
    flexDirection: 'row',
    gap: 6,
  },
  legendCell: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    opacity: 0.8,
  },
  weeklyWrap: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    gap: 8,
  },
  weeklyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  weeklyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weeklyLabel: {
    width: 34,
    fontSize: 12,
    opacity: 0.8,
  },
  weeklyBarTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  weeklyBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2563eb',
  },
  weeklyValue: {
    width: 28,
    textAlign: 'right',
    fontSize: 12,
    color: '#1f2937',
  },
});
