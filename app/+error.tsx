import { Stack } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

type ErrorProps = {
  error: Error;
  retry: () => void;
};

export default function GlobalErrorScreen({ error, retry }: ErrorProps) {
  return (
    <>
      <Stack.Screen options={{ title: 'Something went wrong' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          The app hit an unexpected problem. Your data is still safe.
        </Text>
        <Text style={styles.detail}>{error?.message || 'Unknown error'}</Text>

        <Pressable style={styles.button} onPress={retry}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  message: {
    textAlign: 'center',
    marginBottom: 10,
    opacity: 0.8,
  },
  detail: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#b91c1c',
  },
  button: {
    backgroundColor: '#2a5fd3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});