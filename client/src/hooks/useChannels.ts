import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import config from "../config";
import type { Channel } from "../types";

export function useChannels(token: string, communityId: number | null) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [newChannelName, setNewChannelName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreateText, setShowCreateText] = useState(false);
  const [showCreateVoice, setShowCreateVoice] = useState(false);

  const fetchChannels = useCallback(async () => {
    if (!communityId) return;
    try {
      const { data } = await axios.get(
        `${config.HTTP}/api/communities/${communityId}/channels`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // data is grouped by category — flatten to a channel list
      const flat: Channel[] = data.flatMap((cat: any) => cat.channels);
      setChannels(flat);
    } catch {
      // fallback — keep existing list
    }
  }, [token, communityId]);

  useEffect(() => {
    setChannels([]); // clear when switching community
    fetchChannels();
  }, [fetchChannels]);

  const createChannel = async (type: "text" | "voice") => {
    if (!newChannelName.trim() || !communityId) return;
    setCreating(true);
    try {
      await axios.post(
        `${config.HTTP}/api/communities/${communityId}/channels`,
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
    if (!communityId) return;
    if (!confirm("Delete this channel?")) return;
    try {
      await axios.delete(
        `${config.HTTP}/api/communities/${communityId}/channels/${id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
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
    refetch: fetchChannels,
  };
}
