import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MemberList from "../components/ui/MemberList";

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

vi.mock("../components/ui/Avatar", () => ({
  default: ({ username }: { username: string }) => (
    <div data-testid="avatar">{username}</div>
  ),
}));

const onlineUsers = [
  { id: 1, username: "testuser", status: "online" as const, statusText: null },
  { id: 2, username: "awayuser", status: "away" as const, statusText: "brb" },
];

const allUsers = [
  { id: 1, username: "testuser" },
  { id: 2, username: "awayuser" },
  { id: 3, username: "offlineuser" },
];

const defaultProps = {
  onlineUsers,
  allUsers,
  currentUserId: 1,
  onUserClick: vi.fn(),
};

describe("MemberList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders online users", () => {
    render(<MemberList {...defaultProps} />);
    expect(screen.getAllByText("testuser").length).toBeGreaterThan(0);
    expect(screen.getAllByText("awayuser").length).toBeGreaterThan(0);
  });

  it("renders offline users separately", () => {
    render(<MemberList {...defaultProps} />);
    expect(screen.getAllByText("offlineuser").length).toBeGreaterThan(0);
    expect(screen.getByText("// OFFLINE")).toBeInTheDocument();
  });

  it("shows online section header", () => {
    render(<MemberList {...defaultProps} />);
    expect(screen.getByText("// ONLINE")).toBeInTheDocument();
  });

  it("shows you label for current user", () => {
    render(<MemberList {...defaultProps} />);
    expect(screen.getByText("you")).toBeInTheDocument();
  });

  it("shows status text for users with status text", () => {
    render(<MemberList {...defaultProps} />);
    expect(screen.getByText("brb")).toBeInTheDocument();
  });

  it("shows empty state when no one online", () => {
    render(<MemberList {...defaultProps} onlineUsers={[]} />);
    expect(screen.getByText(/no one online/i)).toBeInTheDocument();
  });

  it("calls onUserClick when user row is clicked", () => {
    const onUserClick = vi.fn();
    const { container } = render(
      <MemberList {...defaultProps} onUserClick={onUserClick} />,
    );
    const memberRow = container.querySelector(".memberRow");
    fireEvent.click(memberRow!);
    expect(onUserClick).toHaveBeenCalledWith(
      1,
      "testuser",
      expect.any(HTMLElement),
    );
  });

  it("collapses panel when toggle is clicked", () => {
    render(<MemberList {...defaultProps} />);
    const toggle = screen.getByTitle(/hide members/i);
    fireEvent.click(toggle);
    expect(screen.getByTitle(/show members/i)).toBeInTheDocument();
  });

  it("does not show offline section when all users are online", () => {
    const allOnline = [
      { id: 1, username: "testuser" },
      { id: 2, username: "awayuser" },
    ];
    render(<MemberList {...defaultProps} allUsers={allOnline} />);
    expect(screen.queryByText("// OFFLINE")).not.toBeInTheDocument();
  });

  it("shows offline user count", () => {
    render(<MemberList {...defaultProps} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
