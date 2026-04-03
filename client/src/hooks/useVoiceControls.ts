import { useState, useEffect, useCallback } from "react";
import { useVoiceSounds } from "./useVoiceSounds";

type VoiceMode = "open" | "ptt";

const STORAGE_KEY_MUTE = "yakk_mute_key";
const STORAGE_KEY_PTT = "yakk_ptt_key";
const STORAGE_KEY_MODE = "yakk_voice_mode";

export function useVoiceControls(setMuted: (muted: boolean) => void) {
  const { playMute, playUnmute, playDeafen, playUndeafen } = useVoiceSounds();
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [mode, setMode] = useState<VoiceMode>(
    () => (localStorage.getItem(STORAGE_KEY_MODE) as VoiceMode) || "open",
  );
  const [muteKey, setMuteKey] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY_MUTE) || "M",
  );
  const [pttKey, setPttKey] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY_PTT) || "Space",
  );
  const [assigningKey, setAssigningKey] = useState<"mute" | "ptt" | null>(null);
  const [isPttActive, setIsPttActive] = useState(false);

  // Derive the effective mute state
  const effectiveMuted =
    isDeafened || (mode === "ptt" ? !isPttActive : isMuted);

  useEffect(() => {
    setMuted(effectiveMuted);
  }, [effectiveMuted, setMuted]);

  // Mute immediately when switching to PTT mode
  useEffect(() => {
    if (mode === "ptt") setMuted(true);
  }, [mode, setMuted]);

  const toggleMute = useCallback(() => {
    if (isDeafened) {
      setIsDeafened(false);
      setIsMuted(false);
      playUnmute();
    } else {
      setIsMuted((prev) => {
        const next = !prev;
        next ? playMute() : playUnmute();
        return next;
      });
    }
  }, [isDeafened, playMute, playUnmute]);

  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => {
      const next = !prev;
      if (next) {
        setIsMuted(true);
        playDeafen();
      } else {
        playUndeafen();
      }
      return next;
    });
  }, [playDeafen, playUndeafen]);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === "open" ? "ptt" : "open";
      localStorage.setItem(STORAGE_KEY_MODE, next);
      return next;
    });
  }, []);

  const saveKey = useCallback((type: "mute" | "ptt", key: string) => {
    if (type === "mute") {
      setMuteKey(key);
      localStorage.setItem(STORAGE_KEY_MUTE, key);
    } else {
      setPttKey(key);
      localStorage.setItem(STORAGE_KEY_PTT, key);
    }
    setAssigningKey(null);
  }, []);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onPttKeydown) return;

    if (mode === "ptt") {
      api.pttRegister(pttKey);
    } else {
      api.pttUnregister();
      return;
    }

    const handleDown = () => setIsPttActive(true);
    const handleUp = () => setIsPttActive(false);

    api.onPttKeydown(handleDown);
    api.onPttKeyup(handleUp);

    return () => {
      api.offPttKeydown(handleDown);
      api.offPttKeyup(handleUp);
    };
  }, [mode, pttKey]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (assigningKey) {
        e.preventDefault();
        const key = e.code === "Space" ? "Space" : e.key.toUpperCase();
        saveKey(assigningKey, key);
        return;
      }

      const pressed = e.code === "Space" ? "Space" : e.key.toUpperCase();

      if (mode === "open" && pressed === muteKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          toggleMute();
        }
      }

      if (mode === "ptt" && pressed === pttKey) {
        setIsPttActive(true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const pressed = e.code === "Space" ? "Space" : e.key.toUpperCase();
      if (mode === "ptt" && pressed === pttKey) {
        setIsPttActive(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [assigningKey, mode, muteKey, pttKey, toggleMute, saveKey]);

  const resetControls = useCallback(() => {
    setIsMuted(false);
    setIsDeafened(false);
    setIsPttActive(false);
    setAssigningKey(null);
    (window as any).electronAPI?.pttUnregister?.();
  }, []);

  return {
    isMuted: effectiveMuted,
    isDeafened,
    isPttActive,
    mode,
    muteKey,
    pttKey,
    assigningKey,
    toggleMute,
    toggleDeafen,
    toggleMode,
    setAssigningKey,
    resetControls,
  };
}
