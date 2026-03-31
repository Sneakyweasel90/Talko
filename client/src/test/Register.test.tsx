import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Register from "../pages/Register";

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      primary: "#00ff9f",
      primaryDim: "rgba(0,255,159,0.4)",
      primaryGlow: "rgba(0,255,159,0.15)",
      background: "#020a06",
      surface: "#010a05",
      surface2: "#020d07",
      border: "rgba(0,255,159,0.15)",
      text: "rgba(200,255,220,0.9)",
      textDim: "rgba(0,255,159,0.5)",
      error: "#ff3366",
      gridColor: "rgba(0,255,159,0.05)",
    },
  }),
}));

vi.mock("../version", () => ({ APP_VERSION: "1.0.0" }));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children }: any) => children,
}));

describe("Register Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it("renders register form", () => {
    render(<Register />);
    expect(screen.getByPlaceholderText("enter username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("enter password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("confirm password")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("enter invite code"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create identity/i }),
    ).toBeInTheDocument();
  });

  it("shows error when passwords do not match", async () => {
    render(<Register />);
    fireEvent.change(screen.getByPlaceholderText("enter password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("confirm password"), {
      target: { value: "different" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create identity/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it("shows error for password too short", async () => {
    render(<Register />);
    fireEvent.change(screen.getByPlaceholderText("enter username"), {
      target: { value: "validuser" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter password"), {
      target: { value: "123" },
    });
    fireEvent.change(screen.getByPlaceholderText("confirm password"), {
      target: { value: "123" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter invite code"), {
      target: { value: "INVITE123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create identity/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
    });
  });

  it("calls register API with correct data", async () => {
    const axios = await import("axios");
    (axios.default.post as any).mockResolvedValueOnce({
      data: {},
    });

    render(<Register />);
    fireEvent.change(screen.getByPlaceholderText("enter invite code"), {
      target: { value: "INVITE123" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter username"), {
      target: { value: "newuser" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("confirm password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create identity/i }));

    await waitFor(() => {
      expect(axios.default.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/register"),
        {
          username: "newuser",
          password: "password123",
          inviteCode: "INVITE123",
        },
      );
    });
  });

  it("shows error on invalid invite code", async () => {
    const axios = await import("axios");
    (axios.default.isAxiosError as any).mockReturnValue(true);
    (axios.default.post as any).mockRejectedValueOnce({
      response: { data: { error: "Invalid or expired invite code" } },
    });

    render(<Register />);
    fireEvent.change(screen.getByPlaceholderText("enter invite code"), {
      target: { value: "BADINVITE" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter username"), {
      target: { value: "newuser" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("confirm password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create identity/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/invalid or expired invite code/i),
      ).toBeInTheDocument();
    });
  });

  it("shows initializing while loading", async () => {
    const axios = await import("axios");
    (axios.default.post as any).mockImplementation(() => new Promise(() => {}));

    render(<Register />);
    fireEvent.change(screen.getByPlaceholderText("enter invite code"), {
      target: { value: "INVITE123" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter username"), {
      target: { value: "newuser" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("confirm password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create identity/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /initializing/i }),
      ).toBeDisabled();
    });
  });

  it("navigates to login on successful registration", async () => {
    const axios = await import("axios");
    (axios.default.post as any).mockResolvedValueOnce({ data: {} });

    render(<Register />);
    fireEvent.change(screen.getByPlaceholderText("enter invite code"), {
      target: { value: "INVITE123" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter username"), {
      target: { value: "newuser" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("confirm password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create identity/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("does not navigate on failed registration", async () => {
    const axios = await import("axios");
    (axios.default.isAxiosError as any).mockReturnValue(true);
    (axios.default.post as any).mockRejectedValueOnce({
      response: { data: { error: "Username already taken" } },
    });

    render(<Register />);
    fireEvent.change(screen.getByPlaceholderText("enter invite code"), {
      target: { value: "INVITE123" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter username"), {
      target: { value: "existinguser" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("confirm password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create identity/i }));

    await waitFor(() => {
      expect(screen.getByText(/username already taken/i)).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
