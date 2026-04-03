export async function wakeSpace(): Promise<void> {
  const baseUrl = process.env.EXPO_PUBLIC_HF_SPACE_URL;

  if (!baseUrl) return;

  try {
    await fetch(`${baseUrl}/health`, { method: 'GET' });
  } catch {
    // Silent fail: first predict call can still wake the space.
  }
}