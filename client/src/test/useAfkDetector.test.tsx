import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useAfkDetector } from "../hooks/useAfkDetector";

// Mock electronAPI
Object.defineProperty(window, "electronAPI", {
  value: undefined,
  writable: true,
});

describe("useAfkDetector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call joinAfk when not in voice", () => {
    const joinAfk = vi.fn();
    renderHook(() => useAfkDetector(false, null, joinAfk, 1));

    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(joinAfk).not.toHaveBeenCalled();
  });

  it("does not call joinAfk when in voice-afk channel", () => {
    const joinAfk = vi.fn();
    renderHook(() => useAfkDetector(true, "voice-afk", joinAfk, 1));

    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(joinAfk).not.toHaveBeenCalled();
  });

  it("calls joinAfk after timeout when idle in voice", () => {
    const joinAfk = vi.fn();
    renderHook(() => useAfkDetector(true, "voice-general", joinAfk, 1));

    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    expect(joinAfk).toHaveBeenCalledTimes(1);
  });

  it("resets idle time on mouse activity", () => {
    const joinAfk = vi.fn();
    renderHook(() => useAfkDetector(true, "voice-general", joinAfk, 1));

    act(() => {
      vi.advanceTimersByTime(45_000);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove"));
    });

    act(() => {
      vi.advanceTimersByTime(45_000);
    });

    expect(joinAfk).not.toHaveBeenCalled();
  });

  it("cleans up interval on unmount", () => {
    const joinAfk = vi.fn();
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const { unmount } = renderHook(() =>
      useAfkDetector(true, "voice-general", joinAfk, 1),
    );

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
