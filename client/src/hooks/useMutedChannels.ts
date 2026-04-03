import { useState, useCallback } from "react";

const STORAGE_KEY = "talko_muted_channels";

function loadMuted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveMuted(muted: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...muted]));
}

export function useMutedChannels() {
  const [mutedChannels, setMutedChannels] = useState<Set<string>>(loadMuted);

  const toggleMute = useCallback((channelName: string) => {
    setMutedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channelName)) {
        next.delete(channelName);
      } else {
        next.add(channelName);
      }
      saveMuted(next);
      return next;
    });
  }, []);

  const isMuted = useCallback(
    (channelName: string) => mutedChannels.has(channelName),
    [mutedChannels],
  );

  return { mutedChannels, toggleMute, isMuted };
}
