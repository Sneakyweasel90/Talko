import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MessageItem from "../components/messages/MessageItem";
import type { GroupedMessage } from "../types";

vi.mock("../components/messages/LinkPreview", () => ({
  default: () => null,
}));

vi.mock("emoji-picker-react", () => ({
  default: () => null,
}));

const baseMsg: GroupedMessage = {
  id: 1,
  channel_id: "general",
  user_id: 1,
  username: "testuser",
  raw_username: "testuser",
  content: "hello world",
  created_at: new Date().toISOString(),
  reactions: [],
  isGrouped: false,
  reply_to_id: null,
  reply_to_username: null,
  reply_to_content: null,
  edited_at: null,
  user_role: "user",
  user_custom_role_name: null,
};

const defaultProps = {
  isAdmin: false,
  onPin: vi.fn(),
  msg: baseMsg,
  hoveredMsgId: null,
  pickerMsgId: null,
  currentUsername: "testuser",
  currentUserId: 1,
  onHover: vi.fn(),
  onPickerToggle: vi.fn(),
  onReact: vi.fn(),
  onReply: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onUsernameClick: vi.fn(),
  resolveNickname: (_id: number, name: string) => name,
  avatarMap: {},
  onJumpToMessage: vi.fn(),
};

describe("MessageItem", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders message content", () => {
    render(<MessageItem {...defaultProps} />);
    expect(screen.getByText(/hello world/i)).toBeInTheDocument();
  });

  it("renders username and timestamp", () => {
    render(<MessageItem {...defaultProps} />);
    expect(screen.getByText("testuser")).toBeInTheDocument();
  });

  it("shows edited label when message is edited", () => {
    const editedMsg = { ...baseMsg, edited_at: new Date().toISOString() };
    render(<MessageItem {...defaultProps} msg={editedMsg} />);
    expect(screen.getByText(/edited/i)).toBeInTheDocument();
  });

  it("shows action buttons on hover", () => {
    render(<MessageItem {...defaultProps} hoveredMsgId={1} />);
    expect(screen.getByRole("button", { name: /reply/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /del/i })).toBeInTheDocument();
  });

  it("shows edit button for own message on hover", () => {
    render(<MessageItem {...defaultProps} hoveredMsgId={1} />);
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("does not show edit button for other users message", () => {
    render(
      <MessageItem
        {...defaultProps}
        hoveredMsgId={1}
        currentUserId={99}
        currentUsername="otheruser"
      />,
    );
    expect(
      screen.queryByRole("button", { name: /edit/i }),
    ).not.toBeInTheDocument();
  });

  it("activates edit mode when edit button clicked", () => {
    render(<MessageItem {...defaultProps} hoveredMsgId={1} />);
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByDisplayValue("hello world")).toBeInTheDocument();
  });

  it("calls onEdit when save clicked with changed text", () => {
    render(<MessageItem {...defaultProps} hoveredMsgId={1} />);
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const textarea = screen.getByDisplayValue("hello world");
    fireEvent.change(textarea, { target: { value: "updated message" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(defaultProps.onEdit).toHaveBeenCalledWith(1, "updated message");
  });

  it("cancels edit and restores original content", () => {
    render(<MessageItem {...defaultProps} hoveredMsgId={1} />);
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const textarea = screen.getByDisplayValue("hello world");
    fireEvent.change(textarea, { target: { value: "changed text" } });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByText(/hello world/i)).toBeInTheDocument();
  });

  it("calls onDelete when delete confirmed", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MessageItem {...defaultProps} hoveredMsgId={1} />);
    fireEvent.click(screen.getByRole("button", { name: /del/i }));
    expect(defaultProps.onDelete).toHaveBeenCalledWith(1);
  });

  it("does not call onDelete when delete cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<MessageItem {...defaultProps} hoveredMsgId={1} />);
    fireEvent.click(screen.getByRole("button", { name: /del/i }));
    expect(defaultProps.onDelete).not.toHaveBeenCalled();
  });

  it("shows pin button for admin", () => {
    render(<MessageItem {...defaultProps} hoveredMsgId={1} isAdmin={true} />);
    expect(screen.getByRole("button", { name: /pin/i })).toBeInTheDocument();
  });

  it("does not show pin button for non-admin", () => {
    render(<MessageItem {...defaultProps} hoveredMsgId={1} isAdmin={false} />);
    expect(
      screen.queryByRole("button", { name: /pin/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onReply when reply clicked", () => {
    render(<MessageItem {...defaultProps} hoveredMsgId={1} />);
    fireEvent.click(screen.getByRole("button", { name: /reply/i }));
    expect(defaultProps.onReply).toHaveBeenCalledWith(baseMsg);
  });
});
