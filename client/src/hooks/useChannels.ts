import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import config from "../config";
import type { Channel } from "../types";

export function useChannels(token: string) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [newChannelName, setNewChannelName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreateText, setShowCreateText] = useState(false);
  const [showCreateVoice, setShowCreateVoice] = useState(false);

  const fetchChannels = useCallback(async () => {
    try {
      const { data } = await axios.get(`${config.HTTP}/api/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChannels(data);
    } catch {
      // fallback — keep existing list
    }
  }, [token]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const createChannel = async (type: "text" | "voice") => {
    if (!newChannelName.trim()) return;
    setCreating(true);
    try {
      await axios.post(
        `${config.HTTP}/api/channels`,
        { name: newChannelName.trim(), type },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setNewChannelName("");
      setShowCreateText(false);
      setShowCreateVoice(false);
      await fetchChannels();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        alert(err.response?.data?.error || "Failed to create channel");
      }
    } finally {
      setCreating(false);
    }
  };

  const deleteChannel = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this channel?")) return;
    try {
      await axios.delete(`${config.HTTP}/api/channels/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchChannels();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        alert(err.response?.data?.error || "Failed to delete channel");
      }
    }
  };

  const toggleCreateText = () => {
    setShowCreateText((s) => !s);
    setShowCreateVoice(false);
    setNewChannelName("");
  };

  const toggleCreateVoice = () => {
    setShowCreateVoice((s) => !s);
    setShowCreateText(false);
    setNewChannelName("");
  };

  const cancelCreate = () => {
    setShowCreateText(false);
    setShowCreateVoice(false);
    setNewChannelName("");
  };

  const textChannels = channels.filter((c) => c.type === "text");
  const voiceChannels = channels.filter((c) => c.type === "voice" && !c.is_afk);
  const afkChannel = channels.find((c) => c.is_afk) ?? null;

  return {
    textChannels,
    voiceChannels,
    newChannelName,
    setNewChannelName,
    creating,
    showCreateText,
    showCreateVoice,
    createChannel,
    deleteChannel,
    toggleCreateText,
    toggleCreateVoice,
    cancelCreate,
    afkChannel,
  };
}
