import { useState, useRef, useCallback } from "react";
import { Room, RoomEvent, Track  } from "livekit-client";
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
  const voiceChannelRef = useRef<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareTrack, setScreenShareTrack] = useState<MediaStreamTrack | null>(null);
  const [screenShareParticipant, setScreenShareParticipant] = useState<string | null>(null);
  const [localScreenShareTrack, setLocalScreenShareTrack] = useState<MediaStreamTrack | null>(null);


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

  const updateVoiceChannel = useCallback((ch: string | null) => {
    voiceChannelRef.current = ch;
    setVoiceChannel(ch);
  }, []);

  const joinVoice = useCallback(async (channelId: string) => {
    if (roomRef.current || voiceChannelRef.current) {
      send({ type: "voice_leave" });
    }
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
      if (track.source === Track.Source.ScreenShare) {
        setScreenShareTrack(track.mediaStreamTrack);
        setScreenShareParticipant(participant.name ?? participant.identity);
      }
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach(el => el.remove());
      if (track.source === Track.Source.ScreenShare) {
        setScreenShareTrack(null);
        setScreenShareParticipant(null);
      }
    });
    room.on(RoomEvent.Disconnected, () => {
      setInVoice(false);
      updateVoiceChannel(null);
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
    updateVoiceChannel(channelId);
    refreshParticipants(room);
  }, [token, refreshParticipants, send, updateVoiceChannel]);

  const leaveVoice = useCallback(async () => {
    send({ type: "voice_leave" });
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setInVoice(false);
    updateVoiceChannel(null);
    setParticipants([]);
    setParticipantVolumes({});
  }, [send, updateVoiceChannel]);

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

  const stopScreenShare = useCallback(async () => {
      const room = roomRef.current;
      if (!room) return;
      await room.localParticipant.setScreenShareEnabled(false);
      setIsScreenSharing(false);
      setLocalScreenShareTrack(null);
    }, []);

  const startScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setScreenShareEnabled(true);
      setIsScreenSharing(true);
      const pub = Array.from(room.localParticipant.screenShareTrackPublications.values())[0];
      if (pub?.track) {
        setLocalScreenShareTrack(pub.track.mediaStreamTrack);
        pub.track.mediaStreamTrack.addEventListener("ended", () => {
          setIsScreenSharing(false);
          setLocalScreenShareTrack(null);
        });
      }
    } catch (e) {
      console.warn("Screen share failed or cancelled:", e);
    }
  }, [stopScreenShare]);

  const setSelfVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(2, volume));
    saveVolume("__self__", clamped);
    setSelfVolumeState(clamped);
  }, []);

  const joinAfk = useCallback(async () => {
    // Disconnect from current LiveKit room if in one
    if (roomRef.current) {
      send({ type: "voice_leave" });
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    // Join AFK presence only — no LiveKit connection
    send({ type: "voice_join", channelId: "voice-afk" });
    setInVoice(false);
    updateVoiceChannel("voice-afk");
    setParticipants([]);
    setParticipantVolumes({});
  }, [send, updateVoiceChannel]);

  return {
    inVoice,
    voiceChannel,
    participants,
    participantVolumes,
    selfVolume,
    joinVoice,
    leaveVoice,
    setParticipantVolume,
    setSelfVolume,
    setMuted,
    setAllParticipantsDeafened,
    joinAfk,
    isScreenSharing,
    screenShareTrack,
    screenShareParticipant,
    startScreenShare,
    stopScreenShare,
    localScreenShareTrack,
  };
}