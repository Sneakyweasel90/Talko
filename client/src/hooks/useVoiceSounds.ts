import { useCallback, useRef } from "react";

function playJoinSound(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc1.type = "sine";
  osc2.type = "sine";
  osc1.frequency.setValueAtTime(587, now);
  osc2.frequency.setValueAtTime(740, now + 0.12);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
  gain.gain.setValueAtTime(0.25, now + 0.1);
  gain.gain.linearRampToValueAtTime(0, now + 0.35);
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.14);
  osc2.start(now + 0.12);
  osc2.stop(now + 0.38);
}

function playLeaveSound(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc1.type = "sine";
  osc2.type = "sine";
  osc1.frequency.setValueAtTime(740, now);
  osc2.frequency.setValueAtTime(587, now + 0.12);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
  gain.gain.setValueAtTime(0.2, now + 0.1);
  gain.gain.linearRampToValueAtTime(0, now + 0.35);
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.14);
  osc2.start(now + 0.12);
  osc2.stop(now + 0.38);
}

function playMuteSound(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.linearRampToValueAtTime(300, now + 0.1);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
  gain.gain.linearRampToValueAtTime(0, now + 0.15);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

function playUnmuteSound(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.linearRampToValueAtTime(420, now + 0.1);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
  gain.gain.linearRampToValueAtTime(0, now + 0.15);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

function playDeafenSound(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc1.type = "sine";
  osc2.type = "sine";
  osc1.frequency.setValueAtTime(500, now);
  osc2.frequency.setValueAtTime(350, now + 0.1);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
  gain.gain.setValueAtTime(0.2, now + 0.08);
  gain.gain.linearRampToValueAtTime(0, now + 0.25);
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.12);
  osc2.start(now + 0.1);
  osc2.stop(now + 0.28);
}

function playUndeafenSound(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc1.type = "sine";
  osc2.type = "sine";
  osc1.frequency.setValueAtTime(350, now);
  osc2.frequency.setValueAtTime(500, now + 0.1);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
  gain.gain.setValueAtTime(0.2, now + 0.08);
  gain.gain.linearRampToValueAtTime(0, now + 0.25);
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.12);
  osc2.start(now + 0.1);
  osc2.stop(now + 0.28);
}

export function useVoiceSounds() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const playJoin = useCallback(() => {
    try {
      playJoinSound(getCtx());
    } catch (e) {
      console.warn("Could not play join sound:", e);
    }
  }, [getCtx]);

  const playLeave = useCallback(() => {
    try {
      playLeaveSound(getCtx());
    } catch (e) {
      console.warn("Could not play leave sound:", e);
    }
  }, [getCtx]);

  const playMute = useCallback(() => {
    try {
      playMuteSound(getCtx());
    } catch (e) {
      console.warn(e);
    }
  }, [getCtx]);

  const playUnmute = useCallback(() => {
    try {
      playUnmuteSound(getCtx());
    } catch (e) {
      console.warn(e);
    }
  }, [getCtx]);

  const playDeafen = useCallback(() => {
    try {
      playDeafenSound(getCtx());
    } catch (e) {
      console.warn(e);
    }
  }, [getCtx]);

  const playUndeafen = useCallback(() => {
    try {
      playUndeafenSound(getCtx());
    } catch (e) {
      console.warn(e);
    }
  }, [getCtx]);

  return {
    playJoin,
    playLeave,
    playMute,
    playUnmute,
    playDeafen,
    playUndeafen,
  };
}
