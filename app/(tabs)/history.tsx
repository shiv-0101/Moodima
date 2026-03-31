import { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '@/components/Themed';
import { supabase } from '@/lib/supabase';

type HistoryEntry = {
  id: string;
  created_at: string;
  verbal_emotion: string;
  acoustic_emotion: string;
  mood_score: number;
  dissonance: number;
  transcript: string | null;
};

export default function HistoryScreen() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadEntries = useCallback(async () => {
    setErrorMsg('');

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) {
      setEntries([]);
      return;
    }

    const { data, error } = await supabase
      .from('mood_entries')
      .select(
        'id, created_at, verbal_emotion, acoustic_emotion, mood_score, dissonance, transcript'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setEntries((data as HistoryEntry[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEntries();
    }, [loadEntries])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>History</Text>
        <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {!!errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>No history yet. Record your first video and check-in.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardDate}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
            <Text style={styles.cardLine}>Mood: {item.mood_score} / 10</Text>
            <Text style={styles.cardLine}>Verbal: {item.verbal_emotion}</Text>
            <Text style={styles.cardLine}>Acoustic: {item.acoustic_emotion}</Text>
            <Text style={styles.cardLine}>Dissonance: {item.dissonance}</Text>
            <Text style={styles.transcript}>
              {item.transcript?.trim() || 'No transcript'}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  signOutButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  signOutText: {
    color: '#fff',
    fontWeight: '700',
  },
  error: {
    color: '#dc2626',
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 18,
  },
  empty: {
    marginTop: 16,
    opacity: 0.8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  cardDate: {
    fontWeight: '700',
    marginBottom: 6,
    color: '#111',
  },
  cardLine: {
    marginBottom: 3,
    color: '#1f2937',
  },
  transcript: {
    marginTop: 8,
    color: '#374151',
  },
});