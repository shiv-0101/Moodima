import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Audio } from 'expo-av';

import { Text } from '@/components/Themed';
import { supabase } from '@/lib/supabase';

type PredictResponse = {
  verbal_emotion: string;
  verbal_score: number;
  acoustic_emotion: string;
  acoustic_score: number;
  transcript: string;
  dissonance: number;
  mood_score: number;
  processing_ms: number;
  demo_mode?: boolean;
};

const DEMO_RESPONSE: PredictResponse = {
  verbal_emotion: 'positive',
  verbal_score: 0.82,
  acoustic_emotion: 'calm',
  acoustic_score: 0.76,
  transcript: 'Demo transcript for hackathon flow.',
  dissonance: 0.03,
  mood_score: 8.1,
  processing_ms: 120,
  demo_mode: true,
};

export default function RecordScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<PredictResponse | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const autoStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autoStopTimeoutRef.current) {
        clearTimeout(autoStopTimeoutRef.current);
        autoStopTimeoutRef.current = null;
      }
      void stopAndCleanupRecordingSilently();
    };
  }, []);

  const stopAndCleanupRecordingSilently = async () => {
    try {
      if (recordingRef.current) {
        const status = await recordingRef.current.getStatusAsync();
        if (status.isRecording) {
          await recordingRef.current.stopAndUnloadAsync();
        }
      }
    } catch {
      // Ignore cleanup errors on unmount
    } finally {
      recordingRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      setErrorMsg('');
      setResult(null);

      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setErrorMsg('Microphone permission is required.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);

      autoStopTimeoutRef.current = setTimeout(() => {
        void stopRecordingAndAnalyze();
      }, 30000);
    } catch (err: any) {
      setIsRecording(false);
      setErrorMsg(err?.message || 'Unable to start recording.');
    }
  };

  const stopRecordingAndAnalyze = async () => {
    if (!recordingRef.current) return;

    setIsLoading(true);
    setErrorMsg('');

    try {
      if (autoStopTimeoutRef.current) {
        clearTimeout(autoStopTimeoutRef.current);
        autoStopTimeoutRef.current = null;
      }

      const recording = recordingRef.current;
      recordingRef.current = null;

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      setIsRecording(false);

      if (!uri) {
        throw new Error('Recording file was not created.');
      }

      if (demoModeEnabled) {
        setResult({ ...DEMO_RESPONSE, processing_ms: 100 });
        return;
      }

      const sessionResult = await supabase.auth.getSession();
      const userId = sessionResult.data.session?.user?.id ?? 'anonymous';

      const formData = new FormData();
      formData.append(
        'audio',
        {
          uri,
          name: 'recording.m4a',
          type: 'audio/m4a',
        } as any
      );

      const baseUrl = process.env.EXPO_PUBLIC_HF_SPACE_URL;
      if (!baseUrl) {
        throw new Error('HF Space URL missing in environment.');
      }

      const response = await fetch(`${baseUrl}/predict`, {
        method: 'POST',
        headers: {
          'x-user-id': userId,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || data?.detail || 'Prediction failed.');
      }

      setResult(data as PredictResponse);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not analyze recording.');
    } finally {
      setIsLoading(false);
      setIsRecording(false);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    }
  };

  const onRecordPress = async () => {
    if (isLoading) return;

    if (isRecording) {
      await stopRecordingAndAnalyze();
    } else {
      await startRecording();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Record</Text>
      <Text style={styles.subtitle}>Capture voice, analyze mood, view scores.</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Demo Mode</Text>
        <Switch
          value={demoModeEnabled}
          onValueChange={setDemoModeEnabled}
          disabled={isRecording || isLoading}
        />
      </View>

      <Pressable
        style={[
          styles.recordButton,
          isRecording && styles.recordingButton,
          isLoading && styles.disabledButton,
        ]}
        onPress={onRecordPress}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.recordButtonText}>
            {isRecording ? 'Stop & Analyze' : 'Start Recording'}
          </Text>
        )}
      </Pressable>

      <Text style={styles.helperText}>
        {isRecording
          ? 'Recording... will auto-stop at 30 seconds.'
          : 'Press start to record. Press again to stop early.'}
      </Text>

      {!!errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Analysis Result</Text>

          <Text style={styles.resultLine}>Mood Score: {result.mood_score} / 10</Text>
          <Text style={styles.resultLine}>
            Verbal: {result.verbal_emotion} ({result.verbal_score})
          </Text>
          <Text style={styles.resultLine}>
            Acoustic: {result.acoustic_emotion} ({result.acoustic_score})
          </Text>
          <Text style={styles.resultLine}>Dissonance: {result.dissonance}</Text>
          <Text style={styles.resultLine}>Processing: {result.processing_ms} ms</Text>
          <Text style={styles.resultLine}>
            Source: {result.demo_mode ? 'Demo mode' : 'Live backend'}
          </Text>

          <Text style={styles.transcriptTitle}>Transcript</Text>
          <Text style={styles.transcript}>{result.transcript || 'No transcript available.'}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    opacity: 0.75,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  recordButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: '#dc2626',
  },
  disabledButton: {
    opacity: 0.7,
  },
  recordButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  helperText: {
    marginTop: 10,
    opacity: 0.8,
  },
  error: {
    marginTop: 10,
    color: '#dc2626',
    fontWeight: '600',
  },
  resultCard: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111',
  },
  resultLine: {
    marginBottom: 4,
    color: '#333',
  },
  transcriptTitle: {
    marginTop: 10,
    fontWeight: '700',
    color: '#111',
  },
  transcript: {
    marginTop: 4,
    lineHeight: 20,
    color: '#333',
  },
});