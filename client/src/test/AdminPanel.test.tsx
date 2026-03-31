import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AdminPanel from "../components/overlays/AdminPanel";
import "@testing-library/jest-dom";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

vi.mock("../config", () => ({
  default: { HTTP: "http://localhost:4000" },
}));

vi.mock("*.module.css", () => ({
  default: new Proxy({}, { get: (_t, key) => key }),
}));

vi.mock("../components/ui/Avatar", () => ({
  default: ({ username }: { username: string }) => <div>{username}</div>,
}));

vi.mock("../components/overlays/InvitePanel", () => ({
  default: () => <div>Invite Panel</div>,
}));

const mockUsers = [
  {
    id: 1,
    username: "adminuser",
    nickname: null,
    avatar: null,
    role: "admin",
    custom_role_name: null,
    banned_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    username: "testuser",
    nickname: null,
    avatar: null,
    role: "user",
    custom_role_name: null,
    banned_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    username: "banneduser",
    nickname: null,
    avatar: null,
    role: "user",
    custom_role_name: null,
    banned_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
];

describe("AdminPanel", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const axios = await import("axios");
    (axios.default.get as any).mockImplementation((url: string) => {
      if (url.includes("/api/admin/users")) {
        return Promise.resolve({ data: { users: mockUsers, ownerId: 1 } });
      }
      if (url.includes("/api/admin/afk-timeout")) {
        return Promise.resolve({ data: { afk_timeout_minutes: 10 } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it("renders users list", async () => {
    render(<AdminPanel token="testtoken" currentUserId={1} />);
    await waitFor(() => {
      expect(screen.getAllByText("testuser").length).toBeGreaterThan(0);
      expect(screen.getAllByText("banneduser").length).toBeGreaterThan(0);
    });
  });

  it("calls kick API when kick button clicked", async () => {
    const axios = await import("axios");
    (axios.default.post as any).mockResolvedValue({ data: { ok: true } });
    vi.spyOn(window, "prompt").mockReturnValue("10");
    vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<AdminPanel token="testtoken" currentUserId={1} />);
    await waitFor(() => screen.getAllByRole("button", { name: /kick/i })[0]);

    fireEvent.click(screen.getAllByRole("button", { name: /kick/i })[0]);

    await waitFor(() => {
      expect(axios.default.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/users/2/kick"),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  it("calls ban API when ban button clicked", async () => {
    const axios = await import("axios");
    (axios.default.post as any).mockResolvedValue({ data: { ok: true } });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<AdminPanel token="testtoken" currentUserId={1} />);
    await waitFor(() => screen.getAllByRole("button", { name: /ban/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /ban/i })[0]);

    await waitFor(() => {
      expect(axios.default.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/users/2/ban"),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  it("calls delete API when delete button clicked and confirmed", async () => {
    const axios = await import("axios");
    (axios.default.delete as any).mockResolvedValue({ data: { ok: true } });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<AdminPanel token="testtoken" currentUserId={1} />);
    await waitFor(() => screen.getAllByRole("button", { name: /delete/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /delete/i })[0]);

    await waitFor(() => {
      expect(axios.default.delete).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/users/2"),
        expect.any(Object),
      );
    });
  });

  it("does not call delete API when cancelled", async () => {
    const axios = await import("axios");
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<AdminPanel token="testtoken" currentUserId={1} />);
    await waitFor(() => screen.getAllByRole("button", { name: /delete/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /delete/i })[0]);

    expect(axios.default.delete).not.toHaveBeenCalled();
  });

  it("shows unban button for banned users", async () => {
    render(<AdminPanel token="testtoken" currentUserId={1} />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /unban/i }),
      ).toBeInTheDocument();
    });
  });
});
