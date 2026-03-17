import { useState, useRef, useCallback } from "react";
import { Room, RoomEvent, RemoteParticipant, Track, RemoteTrackPublication } from "livekit-client";
import axios from "axios";
import config from "../config";

function loadVolume(key: string): number {
  const val = localStorage.getItem(`talko_vol_${key}`);
  return val !== null ? parseFloat(val) : 1;
}

function saveVolume(key: string, vol: number) {
  localStorage.setItem(`talko_vol_${key}`, String(vol));
}

export function useVoice(token: string, send: (data: object) => void) {
  const [inVoice, setInVoice] = useState(false);
  const [voiceChannel, setVoiceChannel] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>({});
  const [selfVolume, setSelfVolumeState] = useState<number>(() => loadVolume("__self__"));

  const roomRef = useRef<Room | null>(null);
  const isDeafenedRef = useRef(false);

  const refreshParticipants = useCallback((room: Room) => {
    const names = Array.from(room.remoteParticipants.values()).map(p => p.name ?? p.identity);
    setParticipants(names);
    setParticipantVolumes(prev => {
      const next: Record<string, number> = {};
      names.forEach(name => { next[name] = prev[name] ?? loadVolume(name); });
      return next;
    });
  }, []);

  const joinVoice = useCallback(async (channelId: string) => {
    // Leave existing room if any
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }

    const { data } = await axios.post(
      `${config.HTTP}/api/voice/token`,
      { channelId },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.ParticipantConnected, () => refreshParticipants(room));
    room.on(RoomEvent.ParticipantDisconnected, () => refreshParticipants(room));
    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        el.volume = isDeafenedRef.current ? 0 : (loadVolume(participant.name ?? participant.identity));
        document.body.appendChild(el);
      }
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach(el => el.remove());
    });
    room.on(RoomEvent.Disconnected, () => {
      setInVoice(false);
      setVoiceChannel(null);
      setParticipants([]);
      setParticipantVolumes({});
      roomRef.current = null;
    });

    await room.connect(data.url, data.token);
    send({ type: "voice_join", channelId });
    await room.localParticipant.setMicrophoneEnabled(true);
    room.localParticipant.audioTrackPublications.forEach(pub => {
      if (pub.track) pub.track.mediaStreamTrack.enabled = true;
    });

    setInVoice(true);
    setVoiceChannel(channelId);
    refreshParticipants(room);
  }, [token, refreshParticipants]);

  const leaveVoice = useCallback(async () => {
    send({ type: "voice_leave" });
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setInVoice(false);
    setVoiceChannel(null);
    setParticipants([]);
    setParticipantVolumes({});
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    const room = roomRef.current;
    if (!room) return;
    room.localParticipant.audioTrackPublications.forEach(pub => {
      if (pub.track) pub.track.mediaStreamTrack.enabled = !muted;
    });
  }, []);

  const setAllParticipantsDeafened = useCallback((deafened: boolean) => {
    isDeafenedRef.current = deafened;
    document.querySelectorAll<HTMLAudioElement>("audio").forEach(el => {
      el.volume = deafened ? 0 : 1;
    });
  }, []);

  const setParticipantVolume = useCallback((username: string, volume: number) => {
    const clamped = Math.max(0, Math.min(2, volume));
    saveVolume(username, clamped);
    setParticipantVolumes(prev => ({ ...prev, [username]: clamped }));
    document.querySelectorAll<HTMLAudioElement>("audio").forEach(el => {
      el.volume = Math.min(1, clamped);
    });
  }, []);

  const setSelfVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(2, volume));
    saveVolume("__self__", clamped);
    setSelfVolumeState(clamped);
  }, []);

  // No-op — LiveKit handles reconnection automatically
  const rejoinVoice = useCallback(() => {}, []);
  const handleVoiceMessage = useCallback(async () => {}, []);
  const localStream = useRef<MediaStream | null>(null);

  return {
    inVoice,
    voiceChannel,
    participants,
    participantVolumes,
    selfVolume,
    joinVoice,
    leaveVoice,
    rejoinVoice,
    handleVoiceMessage,
    localStream,
    setParticipantVolume,
    setSelfVolume,
    setMuted,
    setAllParticipantsDeafened,
  };
}