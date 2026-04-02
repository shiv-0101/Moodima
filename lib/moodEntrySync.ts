import AsyncStorage from '@react-native-async-storage/async-storage';

import { notifyMoodEntriesUpdated } from '@/lib/moodEntriesBus';
import { supabase } from '@/lib/supabase';

const QUEUE_KEY = 'moodima.pendingMoodEntries';

export type MoodEntryPayload = {
  local_id: string;
  user_id: string;
  verbal_emotion: string;
  acoustic_emotion: string;
  transcript: string | null;
  verbal_score: number;
  acoustic_score: number;
  dissonance: number;
  mood_score: number;
  queued_at: string;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readQueue = async () => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as MoodEntryPayload[]) : [];
};

const writeQueue = async (queue: MoodEntryPayload[]) => {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const queueMoodEntry = async (entry: Omit<MoodEntryPayload, 'queued_at'>) => {
  const queue = await readQueue();
  const exists = queue.some((item) => item.local_id === entry.local_id);

  if (!exists) {
    queue.push({ ...entry, queued_at: new Date().toISOString() });
    await writeQueue(queue);
  }
};

export const syncMoodEntryQueue = async (userId?: string) => {
  if (!userId) return;

  const queue = await readQueue();
  if (!queue.length) return;

  const remaining: MoodEntryPayload[] = [];
  let syncedAny = false;

  for (const entry of queue) {
    if (entry.user_id !== userId) {
      remaining.push(entry);
      continue;
    }

    let saved = false;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { error } = await supabase.from('mood_entries').insert({
        user_id: entry.user_id,
        verbal_emotion: entry.verbal_emotion,
        acoustic_emotion: entry.acoustic_emotion,
        transcript: entry.transcript,
        verbal_score: entry.verbal_score,
        acoustic_score: entry.acoustic_score,
        dissonance: entry.dissonance,
        mood_score: entry.mood_score,
      });

      if (!error) {
        saved = true;
        syncedAny = true;
        break;
      }

      if (attempt < 2) {
        await delay(1000 * 2 ** attempt);
      }
    }

    if (!saved) {
      remaining.push(entry);
    }
  }

  await writeQueue(remaining);

  if (syncedAny) {
    notifyMoodEntriesUpdated();
  }
};