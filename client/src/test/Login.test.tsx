import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "../pages/Login";

const { mockNavigate, mockLogin } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockLogin: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ login: mockLogin }),
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

describe("Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockLogin.mockClear();
  });

  it("renders login form", () => {
    render(<Login />);
    expect(screen.getByPlaceholderText("enter username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("enter password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("calls API with correct credentials", async () => {
    const axios = await import("axios");
    (axios.default.post as any).mockResolvedValueOnce({
      data: { token: "abc123", user: { id: 1, username: "testuser" } },
    });

    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText("enter username"), {
      target: { value: "testuser" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(axios.default.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/login"),
        { username: "testuser", password: "password123" },
      );
    });
  });

  it("shows error on invalid credentials", async () => {
    const axios = await import("axios");
    (axios.default.isAxiosError as any).mockReturnValue(true);
    (axios.default.post as any).mockRejectedValueOnce({
      response: { data: { error: "Invalid credentials" } },
    });

    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText("enter username"), {
      target: { value: "testuser" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter password"), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it("shows connecting while loading", async () => {
    const axios = await import("axios");
    (axios.default.post as any).mockImplementation(() => new Promise(() => {}));

    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText("enter username"), {
      target: { value: "testuser" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /connecting/i }),
      ).toBeDisabled();
    });
  });

  it("navigates to home on successful login", async () => {
    const axios = await import("axios");
    (axios.default.post as any).mockResolvedValueOnce({
      data: {
        token: "abc123",
        refreshToken: "refresh",
        user: { id: 1, username: "testuser" },
      },
    });

    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText("enter username"), {
      target: { value: "testuser" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("does not navigate on failed login", async () => {
    const axios = await import("axios");
    (axios.default.isAxiosError as any).mockReturnValue(true);
    (axios.default.post as any).mockRejectedValueOnce({
      response: { data: { error: "Invalid credentials" } },
    });

    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText("enter username"), {
      target: { value: "testuser" },
    });
    fireEvent.change(screen.getByPlaceholderText("enter password"), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
