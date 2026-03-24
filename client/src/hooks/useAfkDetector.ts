import { useEffect, useRef, useCallback } from "react";

export function useAfkDetector(
  inVoice: boolean,
  voiceChannel: string | null,
  joinAfk: () => void,
  afkTimeoutMinutes: number = 10,
) {
  const AFK_TIMEOUT_MS = afkTimeoutMinutes * 60 * 1000;
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "wheel"];
    events.forEach(e => window.addEventListener(e, resetActivity, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, resetActivity));
  }, [resetActivity]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Only run the check when in a real voice channel (not already AFK)
    if (!inVoice || voiceChannel === "voice-afk") return;

    timerRef.current = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= AFK_TIMEOUT_MS) {
        joinAfk();
      }
    }, 30_000); // check every 30 seconds

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [inVoice, voiceChannel, joinAfk]);
}