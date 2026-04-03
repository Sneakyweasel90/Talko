import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useUnreadChannels } from "../hooks/useUnreadChannels";

vi.mock("axios", () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { ok: true } }),
  },
}));

vi.mock("../config", () => ({
  default: { HTTP: "http://localhost:4000" },
}));

describe("useUnreadChannels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts with no unread counts", () => {
    const { result } = renderHook(() =>
      useUnreadChannels("testtoken", new Set()),
    );
    expect(result.current.unreadCounts).toEqual({});
  });

  it("sets unread counts from channel_unread_counts event", () => {
    const { result } = renderHook(() =>
      useUnreadChannels("testtoken", new Set()),
    );

    act(() => {
      result.current.handleUnreadMessage({
        type: "channel_unread_counts",
        counts: { general: 3, random: 1 },
      });
    });

    expect(result.current.unreadCounts).toEqual({ general: 3, random: 1 });
  });

  it("increments unread count on channel_unread_increment event", () => {
    const { result } = renderHook(() =>
      useUnreadChannels("testtoken", new Set()),
    );

    act(() => {
      result.current.handleUnreadMessage({
        type: "channel_unread_increment",
        channelName: "general",
      });
    });

    expect(result.current.unreadCounts["general"]).toBe(1);

    act(() => {
      result.current.handleUnreadMessage({
        type: "channel_unread_increment",
        channelName: "general",
      });
    });

    expect(result.current.unreadCounts["general"]).toBe(2);
  });

  it("clears unread count when channel is marked as read", async () => {
    const { result } = renderHook(() =>
      useUnreadChannels("testtoken", new Set()),
    );

    act(() => {
      result.current.handleUnreadMessage({
        type: "channel_unread_counts",
        counts: { general: 5 },
      });
    });

    await act(async () => {
      await result.current.markChannelRead("general");
    });

    expect(result.current.unreadCounts["general"]).toBeUndefined();
  });

  it("skips increment for muted channels", () => {
    const mutedChannels = new Set(["general"]);
    const { result } = renderHook(() =>
      useUnreadChannels("testtoken", mutedChannels),
    );

    act(() => {
      result.current.handleUnreadMessage({
        type: "channel_unread_increment",
        channelName: "general",
      });
    });

    expect(result.current.unreadCounts["general"]).toBeUndefined();
  });

  it("still increments for non-muted channels when others are muted", () => {
    const mutedChannels = new Set(["general"]);
    const { result } = renderHook(() =>
      useUnreadChannels("testtoken", mutedChannels),
    );

    act(() => {
      result.current.handleUnreadMessage({
        type: "channel_unread_increment",
        channelName: "random",
      });
    });

    expect(result.current.unreadCounts["random"]).toBe(1);
  });

  it("calls markChannelRead API", async () => {
    const axios = await import("axios");
    const { result } = renderHook(() =>
      useUnreadChannels("testtoken", new Set()),
    );

    await act(async () => {
      await result.current.markChannelRead("general");
    });

    expect(axios.default.post).toHaveBeenCalledWith(
      expect.stringContaining("/api/channels/read"),
      { channelName: "general" },
      expect.any(Object),
    );
  });
});
