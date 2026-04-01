type MoodEntriesListener = () => void;

const listeners = new Set<MoodEntriesListener>();

export const subscribeMoodEntriesUpdated = (listener: MoodEntriesListener) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const notifyMoodEntriesUpdated = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Never let one listener break others.
    }
  });
};