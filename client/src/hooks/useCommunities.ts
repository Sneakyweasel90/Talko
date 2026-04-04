import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import config from "../config";

export interface Community {
  id: number;
  name: string;
  icon: string | null;
  description: string | null;
  member_count: number;
  owner_id: number;
}

export function useCommunities(token: string) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCommunityId, setActiveCommunityId] = useState<number | null>(
    null,
  );

  const fetchCommunities = useCallback(async () => {
    try {
      const { data } = await axios.get(`${config.HTTP}/api/communities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCommunities(data);
      // Auto-select first community if none selected
      if (data.length > 0 && activeCommunityId === null) {
        setActiveCommunityId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch communities:", err);
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  const switchCommunity = useCallback((id: number) => {
    setActiveCommunityId(id);
  }, []);

  const addCommunity = useCallback((community: Community) => {
    setCommunities((prev) => [...prev, community]);
    setActiveCommunityId(community.id);
  }, []);

  const removeCommunity = useCallback(
    (id: number) => {
      setCommunities((prev) => prev.filter((c) => c.id !== id));
      if (activeCommunityId === id) {
        const remaining = communities.filter((c) => c.id !== id);
        setActiveCommunityId(remaining[0]?.id ?? null);
      }
    },
    [activeCommunityId, communities],
  );

  const activeCommunity =
    communities.find((c) => c.id === activeCommunityId) ?? null;

  return {
    communities,
    loading,
    activeCommunityId,
    activeCommunity,
    switchCommunity,
    addCommunity,
    refetch: fetchCommunities,
    removeCommunity,
  };
}
