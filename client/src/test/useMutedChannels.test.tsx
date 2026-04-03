import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { useMutedChannels } from "../hooks/useMutedChannels";

describe("useMutedChannels", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with no muted channels", () => {
    const { result } = renderHook(() => useMutedChannels());
    expect(result.current.mutedChannels.size).toBe(0);
  });

  it("mutes a channel", () => {
    const { result } = renderHook(() => useMutedChannels());

    act(() => {
      result.current.toggleMute("general");
    });

    expect(result.current.mutedChannels.has("general")).toBe(true);
  });

  it("unmutes a muted channel", () => {
    const { result } = renderHook(() => useMutedChannels());

    act(() => {
      result.current.toggleMute("general");
    });

    act(() => {
      result.current.toggleMute("general");
    });

    expect(result.current.mutedChannels.has("general")).toBe(false);
  });

  it("isMuted returns true for muted channel", () => {
    const { result } = renderHook(() => useMutedChannels());

    act(() => {
      result.current.toggleMute("general");
    });

    expect(result.current.isMuted("general")).toBe(true);
  });

  it("isMuted returns false for unmuted channel", () => {
    const { result } = renderHook(() => useMutedChannels());
    expect(result.current.isMuted("general")).toBe(false);
  });

  it("can mute multiple channels independently", () => {
    const { result } = renderHook(() => useMutedChannels());

    act(() => {
      result.current.toggleMute("general");
      result.current.toggleMute("random");
    });

    expect(result.current.mutedChannels.has("general")).toBe(true);
    expect(result.current.mutedChannels.has("random")).toBe(true);
    expect(result.current.mutedChannels.has("yakking")).toBe(false);
  });

  it("persists muted channels to localStorage", () => {
    const { result } = renderHook(() => useMutedChannels());

    act(() => {
      result.current.toggleMute("general");
    });

    const stored = localStorage.getItem("talko_muted_channels");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toContain("general");
  });

  it("loads muted channels from localStorage on mount", () => {
    localStorage.setItem(
      "talko_muted_channels",
      JSON.stringify(["general", "random"]),
    );

    const { result } = renderHook(() => useMutedChannels());

    expect(result.current.mutedChannels.has("general")).toBe(true);
    expect(result.current.mutedChannels.has("random")).toBe(true);
  });
});
