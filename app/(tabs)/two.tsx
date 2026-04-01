import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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
  const [entries, setEntries] = useState<HeatmapEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
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

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Heatmap</Text>
      <Text style={styles.subtitle}>Last 28 check-ins by mood intensity</Text>

      {!!errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      {entries.length === 0 ? (
        <Text style={styles.empty}>No entries yet. Record your first check-in.</Text>
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
  empty: {
    marginTop: 12,
    opacity: 0.8,
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
});
