import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ChannelList from "../components/sidebar/ChannelList";
import type { Channel } from "../types";

vi.mock("../components/ui/Avatar", () => ({
  default: ({ username }: { username: string }) => <div>{username}</div>,
}));

const textChannels: Channel[] = [
  { id: 1, name: "general", type: "text", created_by: null, created_at: "" },
  { id: 2, name: "random", type: "text", created_by: 1, created_at: "" },
];

const voiceChannels: Channel[] = [
  {
    id: 3,
    name: "voice-general",
    type: "voice",
    created_by: null,
    created_at: "",
  },
];

const afkChannel: Channel = {
  id: 4,
  name: "voice-afk",
  type: "voice",
  created_by: null,
  created_at: "",
  is_afk: true,
};

const defaultProps = {
  textChannels,
  voiceChannels,
  activeChannel: "general",
  voiceChannel: null,
  participants: [],
  username: "testuser",
  newChannelName: "",
  creating: false,
  showCreateText: false,
  showCreateVoice: false,
  unreadCounts: {},
  voiceOccupancy: {},
  mutedChannels: new Set<string>(),
  activeSpeakers: new Set<string>(),
  onSelectChannel: vi.fn(),
  onJoinVoice: vi.fn(),
  onLeaveVoice: vi.fn(),
  onDeleteChannel: vi.fn(),
  onToggleCreateText: vi.fn(),
  onToggleCreateVoice: vi.fn(),
  onChannelNameChange: vi.fn(),
  onCreateChannel: vi.fn(),
  onCancelCreate: vi.fn(),
  onToggleMute: vi.fn(),
  afkChannel,
  onJoinAfk: vi.fn(),
  mentionedChannels: new Set<string>(),
};

describe("ChannelList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders text channels", () => {
    render(<ChannelList {...defaultProps} />);
    expect(screen.getAllByText("general").length).toBeGreaterThan(0);
    expect(screen.getByText("random")).toBeInTheDocument();
  });

  it("renders voice channels with prefix stripped", () => {
    render(<ChannelList {...defaultProps} />);
    expect(screen.getAllByText("general").length).toBe(2);
  });

  it("renders AFK channel", () => {
    render(<ChannelList {...defaultProps} />);
    expect(screen.getByText("AFK")).toBeInTheDocument();
  });

  it("calls onSelectChannel when text channel clicked", () => {
    render(<ChannelList {...defaultProps} />);
    const generals = screen.getAllByText("general");
    fireEvent.click(generals[0]);
    expect(defaultProps.onSelectChannel).toHaveBeenCalledWith("general");
  });

  it("calls onJoinAfk when AFK channel clicked", () => {
    render(<ChannelList {...defaultProps} />);
    fireEvent.click(screen.getByText("AFK"));
    expect(defaultProps.onJoinAfk).toHaveBeenCalled();
  });

  it("shows unread badge for channels with unread messages", () => {
    render(<ChannelList {...defaultProps} unreadCounts={{ random: 5 }} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows 99+ for large unread counts", () => {
    render(<ChannelList {...defaultProps} unreadCounts={{ random: 150 }} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("does not show unread badge for active channel", () => {
    render(
      <ChannelList
        {...defaultProps}
        activeChannel="general"
        unreadCounts={{ general: 3 }}
      />,
    );
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("shows mention badge for mentioned channels", () => {
    render(
      <ChannelList {...defaultProps} mentionedChannels={new Set(["random"])} />,
    );
    expect(screen.getByText("@")).toBeInTheDocument();
  });

  it("shows mute icon for muted channels", () => {
    render(
      <ChannelList {...defaultProps} mutedChannels={new Set(["random"])} />,
    );
    expect(screen.getByTitle("Muted")).toBeInTheDocument();
  });

  it("does not show unread badge for muted channels", () => {
    render(
      <ChannelList
        {...defaultProps}
        mutedChannels={new Set(["random"])}
        unreadCounts={{ random: 5 }}
      />,
    );
    expect(screen.queryByText("5")).not.toBeInTheDocument();
  });

  it("shows delete button for user-created channels", () => {
    render(<ChannelList {...defaultProps} />);
    expect(screen.getByTitle("Delete channel")).toBeInTheDocument();
  });

  it("shows create text channel input when showCreateText is true", () => {
    render(<ChannelList {...defaultProps} showCreateText={true} />);
    expect(screen.getByPlaceholderText("channel-name")).toBeInTheDocument();
  });

  it("shows LIVE badge when in a voice channel", () => {
    render(<ChannelList {...defaultProps} voiceChannel="voice-general" />);
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("shows AFK badge when in afk channel", () => {
    const { container } = render(
      <ChannelList {...defaultProps} voiceChannel="voice-afk" />,
    );
    const liveBadge = container.querySelector(".liveBadge");
    expect(liveBadge).toBeInTheDocument();
    expect(liveBadge?.textContent).toBe("AFK");
  });

  it("shows context menu on right click", () => {
    render(<ChannelList {...defaultProps} />);
    fireEvent.contextMenu(screen.getByText("random"));
    expect(screen.getByText(/mute channel/i)).toBeInTheDocument();
  });

  it("calls onToggleMute from context menu", () => {
    render(<ChannelList {...defaultProps} />);
    fireEvent.contextMenu(screen.getByText("random"));
    fireEvent.click(screen.getByText(/mute channel/i));
    expect(defaultProps.onToggleMute).toHaveBeenCalledWith("random");
  });
});
