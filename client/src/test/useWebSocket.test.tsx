import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../config", () => ({
  default: { WS: "ws://localhost:4000" },
}));

const wsInstances: any[] = [];

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.();
  });

  constructor(_url: string) {
    wsInstances.push(this);
  }

  triggerOpen() {
    this.readyState = 1;
    this.onopen?.();
  }
}

vi.stubGlobal("WebSocket", MockWebSocket);

const { useWebSocket } = await import("../hooks/useWebSocket");

describe("useWebSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    wsInstances.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function getLatestWs(): MockWebSocket {
    return wsInstances[wsInstances.length - 1];
  }

  it("connects on mount", () => {
    renderHook(() => useWebSocket("testtoken", vi.fn()));
    expect(wsInstances.length).toBe(1);
    expect(wsInstances[0]).toBeInstanceOf(MockWebSocket);
  });

  it("status starts as connecting then becomes connected", () => {
    const { result } = renderHook(() => useWebSocket("testtoken", vi.fn()));
    expect(result.current.status).toBe("connecting");

    act(() => getLatestWs().triggerOpen());

    expect(result.current.status).toBe("connected");
  });

  it("status becomes disconnected when connection drops", () => {
    const { result } = renderHook(() => useWebSocket("testtoken", vi.fn()));

    act(() => getLatestWs().triggerOpen());
    expect(result.current.status).toBe("connected");

    act(() => {
      const ws = getLatestWs();
      ws.readyState = 3;
      ws.onclose?.();
    });

    expect(result.current.status).toBe("disconnected");
  });

  it("attempts reconnect after disconnect", () => {
    renderHook(() => useWebSocket("testtoken", vi.fn()));
    act(() => getLatestWs().triggerOpen());

    const firstCount = wsInstances.length;

    act(() => {
      const ws = getLatestWs();
      ws.readyState = 3;
      ws.onclose?.();
    });

    act(() => vi.advanceTimersByTime(2100));

    expect(wsInstances.length).toBeGreaterThan(firstCount);
  });

  it("calls onMessage when message received", () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket("testtoken", onMessage));

    act(() => getLatestWs().triggerOpen());

    act(() => {
      getLatestWs().onmessage?.({
        data: JSON.stringify({ type: "pong" }),
      });
    });

    expect(onMessage).toHaveBeenCalledWith({ type: "pong" });
  });

  it("disconnects cleanly on unmount", () => {
    const { unmount } = renderHook(() => useWebSocket("testtoken", vi.fn()));
    act(() => getLatestWs().triggerOpen());

    const ws = getLatestWs();
    unmount();

    expect(ws.close).toHaveBeenCalled();
  });

  it("does not reconnect after intentional disconnect", () => {
    const { result } = renderHook(() => useWebSocket("testtoken", vi.fn()));
    act(() => getLatestWs().triggerOpen());
    act(() => result.current.disconnect());

    const countAfterDisconnect = wsInstances.length;
    act(() => vi.advanceTimersByTime(5000));

    expect(wsInstances.length).toBe(countAfterDisconnect);
  });
});
