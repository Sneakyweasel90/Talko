import { useState, useRef, useCallback } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
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
  const [participantVolumes, setParticipantVolumes] = useState<
    Record<string, number>
  >({});
  const [selfVolume, setSelfVolumeState] = useState<number>(() =>
    loadVolume("__self__"),
  );
  const voiceChannelRef = useRef<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareTrack, setScreenShareTrack] =
    useState<MediaStreamTrack | null>(null);
  const [screenShareParticipant, setScreenShareParticipant] = useState<
    string | null
  >(null);
  const [localScreenShareTrack, setLocalScreenShareTrack] =
    useState<MediaStreamTrack | null>(null);

  const roomRef = useRef<Room | null>(null);
  const isDeafenedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});

  const refreshParticipants = useCallback((room: Room) => {
    const names = Array.from(room.remoteParticipants.values()).map(
      (p) => p.name ?? p.identity,
    );
    setParticipants(names);
    setParticipantVolumes((prev) => {
      const next: Record<string, number> = {};
      names.forEach((name) => {
        next[name] = prev[name] ?? loadVolume(name);
      });
      return next;
    });
  }, []);

  const updateVoiceChannel = useCallback((ch: string | null) => {
    voiceChannelRef.current = ch;
    setVoiceChannel(ch);
  }, []);

  const joinVoice = useCallback(
    async (channelId: string) => {
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
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, () => refreshParticipants(room));
      room.on(RoomEvent.ParticipantDisconnected, () =>
        refreshParticipants(room),
      );
      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          const name = participant.name ?? participant.identity;
          el.volume = isDeafenedRef.current ? 0 : loadVolume(name);
          audioElementsRef.current[name] = el;
          document.body.appendChild(el);
        }
        if (track.source === Track.Source.ScreenShare) {
          setScreenShareTrack(track.mediaStreamTrack);
          setScreenShareParticipant(participant.name ?? participant.identity);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => {
          for (const [name, audioEl] of Object.entries(
            audioElementsRef.current,
          )) {
            if (audioEl === el) delete audioElementsRef.current[name];
          }
          el.remove();
        });
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
        audioContextRef.current?.close();
        audioContextRef.current = null;
        setIsScreenSharing(false);
        setLocalScreenShareTrack(null);
        setScreenShareTrack(null);
        setScreenShareParticipant(null);
        audioElementsRef.current = {};
      });

      await room.connect(data.url, data.token);
      send({ type: "voice_join", channelId });

      try {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        // load wasm binary via Electron IPC (handles asar unpacking)
        let wasmBinary: ArrayBuffer;
        if ((window as any).electronAPI?.readFile) {
          const buf = await (window as any).electronAPI.readFile(
            "rnnoise.wasm",
          );
          wasmBinary = buf.buffer.slice(
            buf.byteOffset,
            buf.byteOffset + buf.byteLength,
          );
        } else {
          const res = await fetch("/rnnoise.wasm");
          wasmBinary = await res.arrayBuffer();
        }

        let workletUrl: string;
        if ((window as any).electronAPI?.readFile) {
          const workletBuf = await (window as any).electronAPI.readFile(
            "workletProcessor.js",
          );
          const blob = new Blob([workletBuf], {
            type: "application/javascript",
          });
          workletUrl = URL.createObjectURL(blob);
        } else {
          workletUrl = "/workletProcessor.js";
        }
        await audioContext.audioWorklet.addModule(workletUrl);
        if (workletUrl.startsWith("blob:")) URL.revokeObjectURL(workletUrl);

        const source = audioContext.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(
          audioContext,
          "@sapphi-red/web-noise-suppressor/rnnoise",
          {
            processorOptions: { wasmBinary, maxChannels: 1 },
          },
        );

        const dest = audioContext.createMediaStreamDestination();
        source.connect(workletNode);
        workletNode.connect(dest);

        const processedTrack = dest.stream.getAudioTracks()[0];
        await room.localParticipant.publishTrack(processedTrack, {
          source: Track.Source.Microphone,
        });
      } catch (e) {
        console.warn("RNNoise failed, falling back to plain mic:", e);
        await room.localParticipant.setMicrophoneEnabled(true);
      }

      setInVoice(true);
      updateVoiceChannel(channelId);
      refreshParticipants(room);
    },
    [token, refreshParticipants, send, updateVoiceChannel],
  );

  const leaveVoice = useCallback(async () => {
    send({ type: "voice_leave" });
    await roomRef.current?.disconnect();
    roomRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setInVoice(false);
    updateVoiceChannel(null);
    setParticipants([]);
    setParticipantVolumes({});
    audioElementsRef.current = {};
  }, [send, updateVoiceChannel]);

  const setMuted = useCallback((muted: boolean) => {
    const room = roomRef.current;
    if (!room) return;
    room.localParticipant.audioTrackPublications.forEach((pub) => {
      if (pub.track) pub.track.mediaStreamTrack.enabled = !muted;
    });
  }, []);

  const setAllParticipantsDeafened = useCallback((deafened: boolean) => {
    isDeafenedRef.current = deafened;
    Object.values(audioElementsRef.current).forEach((el) => {
      el.volume = deafened ? 0 : 1;
    });
  }, []);

  const setParticipantVolume = useCallback(
    (username: string, volume: number) => {
      const clamped = Math.max(0, Math.min(2, volume));
      saveVolume(username, clamped);
      setParticipantVolumes((prev) => ({ ...prev, [username]: clamped }));
      // target only this participant's audio element
      const el = audioElementsRef.current[username];
      if (el) el.volume = Math.min(1, clamped);
    },
    [],
  );

  const [pickerSources, setPickerSources] = useState<
    { id: string; name: string; thumbnailDataURL: string }[] | null
  >(null);

  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    // find the screen share publication
    const pub = Array.from(
      room.localParticipant.videoTrackPublications.values(),
    ).find((p) => p.source === Track.Source.ScreenShare);

    if (pub) {
      await room.localParticipant.unpublishTrack(pub.track!);
      pub.track?.stop();
    }

    setIsScreenSharing(false);
    setLocalScreenShareTrack(null);
  }, []);

  const startScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const sources = await (window as any).electronAPI.getSources();
      setPickerSources(sources);
    } catch (e) {
      console.warn("Failed to get sources:", e);
    }
  }, []);

  const selectSource = useCallback(
    async (sourceId: string) => {
      const room = roomRef.current;
      if (!room) return;
      setPickerSources(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: sourceId,
            },
          } as any,
        });
        const track = stream.getVideoTracks()[0];
        await room.localParticipant.publishTrack(track, {
          source: Track.Source.ScreenShare,
        });
        setIsScreenSharing(true);
        setLocalScreenShareTrack(track);
        track.addEventListener("ended", () => stopScreenShare());
      } catch (e) {
        console.warn("Screen share failed:", e);
      }
    },
    [stopScreenShare],
  );

  const cancelPicker = useCallback(() => setPickerSources(null), []);

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
    pickerSources,
    selectSource,
    cancelPicker,
  };
}
