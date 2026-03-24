import { useEffect, useRef, useCallback } from "react";

export function useAfkDetector(
  inVoice: boolean,
  voiceChannel: string | null,
  joinAfk: () => void,
  afkTimeoutMinutes: number = 10,
) {
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
    if (!inVoice || voiceChannel === "voice-afk") return;

    const AFK_TIMEOUT_MS = afkTimeoutMinutes * 60 * 1000;
    const isElectron = !!(window as any).electronAPI?.getIdleTime;

    timerRef.current = setInterval(async () => {
      let idle: number;
      if (isElectron) {
        const idleSecs = await (window as any).electronAPI.getIdleTime();
        idle = idleSecs * 1000;
        console.log(`[AFK] Electron idle: ${idleSecs}s, timeout: ${afkTimeoutMinutes * 60}s, inVoice: ${inVoice}, channel: ${voiceChannel}`);
      } else {
        idle = Date.now() - lastActivityRef.current;
        console.log(`[AFK] Browser idle: ${Math.round(idle/1000)}s, timeout: ${afkTimeoutMinutes * 60}s`);
      }
      if (idle >= AFK_TIMEOUT_MS) {
        console.log(`[AFK] Triggering joinAfk`);
        joinAfk();
      }
    }, 30_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [inVoice, voiceChannel, joinAfk, afkTimeoutMinutes]);
}