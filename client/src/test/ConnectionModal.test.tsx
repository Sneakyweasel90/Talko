import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConnectionModal from "../components/overlays/ConnectionModal";

describe("ConnectionModal", () => {
  it("renders nothing when connected", () => {
    const { container } = render(
      <ConnectionModal status="connected" onRetry={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows connecting state", () => {
    render(<ConnectionModal status="connecting" onRetry={vi.fn()} />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /retry/i }),
    ).not.toBeInTheDocument();
  });

  it("shows disconnected state with retry button", () => {
    render(<ConnectionModal status="disconnected" onRetry={vi.fn()} />);
    expect(screen.getByText(/connection lost/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls onRetry when retry button clicked", () => {
    const onRetry = vi.fn();
    render(<ConnectionModal status="disconnected" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows overlay when disconnected", () => {
    const { container } = render(
      <ConnectionModal status="disconnected" onRetry={vi.fn()} />,
    );
    expect(container.firstChild).not.toBeNull();
  });
});
