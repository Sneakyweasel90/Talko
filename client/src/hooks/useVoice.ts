import { useRef, useState, useCallback } from "react";
import type { ClientMessage, ServerMessage } from "../types";
import { useVoiceSounds } from "./useVoiceSounds";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: import.meta.env.VITE_METERED_USERNAME,
      credential: import.meta.env.VITE_METERED_CREDENTIAL,
    },
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: import.meta.env.VITE_METERED_USERNAME,
      credential: import.meta.env.VITE_METERED_CREDENTIAL,
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: import.meta.env.VITE_METERED_USERNAME,
      credential: import.meta.env.VITE_METERED_CREDENTIAL,
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: import.meta.env.VITE_METERED_USERNAME,
      credential: import.meta.env.VITE_METERED_CREDENTIAL,
    },
  ],
};

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  autoGainControl: true,
  noiseSuppression: true,
};

function applyNoiseGate(
  audioCtx: AudioContext,
  source: MediaStreamAudioSourceNode,
  destination: MediaStreamAudioDestinationNode,
  gainNode: GainNode,
) {
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.1;

  source.connect(analyser);
  source.connect(gainNode);

  const dataArray = new Float32Array(analyser.fftSize);

  const THRESHOLD = 0.02;
  const RELEASE_MS = 150; // hold open 150ms after signal drops, prevents word clipping

  let isOpen = false;
  let releaseTimer: ReturnType<typeof setTimeout> | null = null;

  gainNode.gain.value = 0;

  const interval = setInterval(() => {
    analyser.getFloatTimeDomainData(dataArray);
    const rms = Math.sqrt(
      dataArray.reduce((sum, v) => sum + v * v, 0) / dataArray.length,
    );

    if (rms > THRESHOLD) {
      if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null; }
      if (!isOpen) {
        isOpen = true;
        gainNode.gain.setTargetAtTime(1, audioCtx.currentTime, 0.01);
      }
    } else if (isOpen && !releaseTimer) {
      releaseTimer = setTimeout(() => {
        isOpen = false;
        releaseTimer = null;
        gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01);
      }, RELEASE_MS);
    }
  }, 10);

  return interval;
}

async function getMicStream(): Promise<{
  stream: MediaStream;
  gainNode: GainNode;
  audioCtx: AudioContext;
}> {
  const rawStream = await navigator.mediaDevices.getUserMedia({
    audio: AUDIO_CONSTRAINTS,
  });

  const audioCtx = new AudioContext({ sampleRate: 48000 });
  const source = audioCtx.createMediaStreamSource(rawStream);
  const gateNode = audioCtx.createGain();   // controlled by noise gate
  const volumeNode = audioCtx.createGain(); // controlled by user volume slider
  const destination = audioCtx.createMediaStreamDestination();

  // Chain: source -> gateNode -> volumeNode -> destination
  applyNoiseGate(audioCtx, source, destination, gateNode);
  gateNode.connect(volumeNode);
  volumeNode.connect(destination);

  const processedStream = new MediaStream([
    ...destination.stream.getAudioTracks(),
  ]);
  return { stream: processedStream, gainNode: volumeNode, audioCtx };
}

function loadVolume(key: string): number {
  const val = localStorage.getItem(`talko_vol_${key}`);
  return val !== null ? parseFloat(val) : 1;
}

function saveVolume(key: string, vol: number) {
  localStorage.setItem(`talko_vol_${key}`, String(vol));
}

// Per-participant audio pipeline: AudioContext + GainNode for volume above 1
interface ParticipantAudio {
  audioCtx: AudioContext;
  gainNode: GainNode;
  audioElement: HTMLAudioElement;
}

export function useVoice(
  send: (data: ClientMessage) => void,
  _currentUserId: number,
) {
  const [inVoice, setInVoice] = useState(false);
  const [voiceChannel, setVoiceChannel] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantVolumes, setParticipantVolumes] = useState<
    Record<string, number>
  >({});
  const [selfVolume, setSelfVolumeState] = useState<number>(() =>
    loadVolume("__self__"),
  );

  const { playJoin, playLeave } = useVoiceSounds();

  const localStream = useRef<MediaStream | null>(null);
  const selfGainNode = useRef<GainNode | null>(null);
  const selfAudioCtx = useRef<AudioContext | null>(null);
  const peers = useRef<Record<number, RTCPeerConnection>>({});
  // Each participant gets their own AudioContext+GainNode pipeline
  const participantAudio = useRef<Record<number, ParticipantAudio>>({});
  const userIdToName = useRef<Record<number, string>>({});

  const createPeer = useCallback(
    (targetUserId: number, isInitiator: boolean): RTCPeerConnection => {
      if (peers.current[targetUserId]) {
        peers.current[targetUserId].close();
        delete peers.current[targetUserId];
      }

      const peer = new RTCPeerConnection(ICE_SERVERS);

      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => {
          peer.addTrack(track, localStream.current!);
        });
      }

      peer.onicecandidate = (e) => {
        if (e.candidate) {
          send({
            type: "voice_ice",
            targetUserId,
            candidate: e.candidate.toJSON(),
          });
        }
      };

      peer.ontrack = async (e) => {
        if (participantAudio.current[targetUserId]) {
          participantAudio.current[targetUserId].audioElement.srcObject = null;
          participantAudio.current[targetUserId].audioCtx.close();
          delete participantAudio.current[targetUserId];
        }

        const username = userIdToName.current[targetUserId];
        const savedVolume = username ? loadVolume(username) : 1;

        const audioCtx = new AudioContext();
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = savedVolume;

        const source = audioCtx.createMediaStreamSource(e.streams[0]);
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        const audioElement = new Audio();
        audioElement.srcObject = e.streams[0];
        audioElement.volume = 0;
        audioElement.autoplay = true;
        audioElement.play().catch(() => {});

        participantAudio.current[targetUserId] = { audioCtx, gainNode, audioElement };
      };

      peer.onconnectionstatechange = () => {
        const state = peer.connectionState;
        console.log(
          `[${new Date().toISOString()}] Peer ${targetUserId} state: ${state}`,
        );
        if (state === "failed") {
          console.warn(`Peer ${targetUserId} failed — attempting ICE restart`);
          if (isInitiator) {
            peer
              .createOffer({ iceRestart: true })
              .then((offer) => peer.setLocalDescription(offer))
              .then(() =>
                send({
                  type: "voice_offer",
                  targetUserId,
                  offer: peer.localDescription!,
                }),
              )
              .catch(console.error);
          }
        }
        if (state === "closed") {
          if (participantAudio.current[targetUserId]) {
            participantAudio.current[targetUserId].audioElement.srcObject =
              null;
            participantAudio.current[targetUserId].audioCtx.close();
            delete participantAudio.current[targetUserId];
          }
        }
      };

      peer.oniceconnectionstatechange = () => {
        console.log(
          `[${new Date().toISOString()}] Peer ${targetUserId} ICE: ${peer.iceConnectionState}`,
        );
      };

      if (isInitiator) {
        peer
          .createOffer()
          .then((offer) => peer.setLocalDescription(offer))
          .then(() =>
            send({
              type: "voice_offer",
              targetUserId,
              offer: peer.localDescription!,
            }),
          )
          .catch(console.error);
      }

      peers.current[targetUserId] = peer;
      return peer;
    },
    [send],
  );

  const setAllParticipantsDeafened = useCallback((deafened: boolean) => {
    Object.entries(participantAudio.current).forEach(([userId, { gainNode }]) => {
      const username = userIdToName.current[Number(userId)];
      gainNode.gain.value = deafened ? 0 : (username ? loadVolume(username) : 1);
    });
  }, []);

  const cleanup = useCallback(() => {
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    selfGainNode.current = null;
    selfAudioCtx.current?.close();
    selfAudioCtx.current = null;
    Object.values(peers.current).forEach((p) => p.close());
    peers.current = {};
    Object.values(participantAudio.current).forEach(
      ({ audioElement, audioCtx }) => {
        audioElement.srcObject = null;
        audioCtx.close();
      },
    );
    participantAudio.current = {};
    userIdToName.current = {};
    setInVoice(false);
    setVoiceChannel(null);
    setParticipants([]);
    setParticipantVolumes({});
  }, []);

  const joinVoice = useCallback(
    async (channelId: string) => {
      if (localStream.current || inVoice) {
        send({ type: "voice_leave" });
        cleanup();
      }
      try {
        const { stream, gainNode, audioCtx } = await getMicStream();
        localStream.current = stream;
        selfGainNode.current = gainNode;
        selfAudioCtx.current = audioCtx;
        gainNode.gain.value = loadVolume("__self__");
        setInVoice(true);
        setVoiceChannel(channelId);
        send({ type: "voice_join", channelId });
      } catch (err) {
        console.error("Microphone access denied:", err);
        alert("Please allow microphone access to use voice chat.");
        cleanup();
      }
    },
    [send, inVoice, cleanup],
  );

  const leaveVoice = useCallback(() => {
    send({ type: "voice_leave" });
    cleanup();
  }, [send, cleanup]);

  const rejoinVoice = useCallback(() => {
    const channel = voiceChannel;
    if (!channel || !localStream.current) return;
    console.log("WS reconnected — rejoining voice channel:", channel);
    Object.values(peers.current).forEach((p) => p.close());
    peers.current = {};
    send({ type: "voice_join", channelId: channel });
  }, [voiceChannel, send]);

  const setParticipantVolume = useCallback(
    (username: string, volume: number) => {
      const clamped = Math.max(0, Math.min(2, volume));
      saveVolume(username, clamped);
      setParticipantVolumes((prev) => ({ ...prev, [username]: clamped }));
      // Find userId for this username and update their GainNode live
      const userId = Object.entries(userIdToName.current).find(
        ([, name]) => name === username,
      )?.[0];
      if (userId && participantAudio.current[Number(userId)]) {
        participantAudio.current[Number(userId)].gainNode.gain.value = clamped;
      }
    },
    [],
  );

  const setSelfVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(2, volume));
    saveVolume("__self__", clamped);
    setSelfVolumeState(clamped);
    if (selfGainNode.current) {
      selfGainNode.current.gain.value = clamped;
    }
  }, []);

  const handleVoiceMessage = useCallback(
    async (data: ServerMessage) => {
      if (data.type === "voice_participants") {
        setParticipants(data.usernames);
        data.userIds.forEach((userId: number, i: number) => {
          userIdToName.current[userId] = data.usernames[i];
        });
        const vols: Record<string, number> = {};
        data.usernames.forEach((name: string) => {
          vols[name] = loadVolume(name);
        });
        setParticipantVolumes(vols);
        data.userIds.forEach((userId: number) => createPeer(userId, true));
      }

      if (data.type === "voice_user_joined") {
        userIdToName.current[data.userId] = data.username;
        setParticipants((prev) =>
          prev.includes(data.username) ? prev : [...prev, data.username],
        );
        setParticipantVolumes((prev) => ({
          ...prev,
          [data.username]: loadVolume(data.username),
        }));
        createPeer(data.userId, false);
        playJoin();
      }

      if (data.type === "voice_user_left") {
        delete userIdToName.current[data.userId];
        setParticipants((prev) => prev.filter((u) => u !== data.username));
        setParticipantVolumes((prev) => {
          const next = { ...prev };
          delete next[data.username];
          return next;
        });
        peers.current[data.userId]?.close();
        delete peers.current[data.userId];
        if (participantAudio.current[data.userId]) {
          participantAudio.current[data.userId].audioElement.srcObject = null;
          participantAudio.current[data.userId].audioCtx.close();
          delete participantAudio.current[data.userId];
        }
        playLeave();
      }

      if (data.type === "voice_offer") {
        if (!localStream.current) {
          const { stream, gainNode, audioCtx } = await getMicStream();
          localStream.current = stream;
          selfGainNode.current = gainNode;
          selfAudioCtx.current = audioCtx;
          gainNode.gain.value = loadVolume("__self__");
        }
        const peer = createPeer(data.userId, false);
        peer
          .setRemoteDescription(data.offer)
          .then(() => peer.createAnswer())
          .then((answer) => peer.setLocalDescription(answer))
          .then(() =>
            send({
              type: "voice_answer",
              targetUserId: data.userId,
              answer: peer.localDescription!,
            }),
          )
          .catch(console.error);
      }

      if (data.type === "voice_answer") {
        peers.current[data.userId]
          ?.setRemoteDescription(data.answer)
          .catch(console.error);
      }

      if (data.type === "voice_ice") {
        const peer = peers.current[data.userId];
        if (peer?.remoteDescription) {
          peer
            .addIceCandidate(new RTCIceCandidate(data.candidate))
            .catch(console.error);
        }
      }
    },
    [createPeer, send, playJoin, playLeave],
  );

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
    setAllParticipantsDeafened,
  };
}
