export type UserRole = "admin" | "user" | "custom";
export type UserStatus = "online" | "away" | "dnd";

export interface User {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
  token: string;
  refreshToken: string;
  role: UserRole;
  customRoleName: string | null;
}

export interface AdminUser {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
  role: UserRole;
  custom_role_name: string | null;
  banned_at: string | null;
  created_at: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface Message {
  id: number;
  channel_id: string;
  user_id: number;
  username: string;
  raw_username: string;
  content: string;
  created_at: string;
  reactions: Reaction[];
  decrypted?: boolean;
  reply_to_id?: number | null;
  reply_to_username?: string | null;
  reply_to_content?: string | null;
  edited_at?: string | null;
  user_role?: string;
  user_custom_role_name?: string | null;
}

export interface GroupedMessage extends Message {
  isGrouped: boolean;
}

export interface Channel {
  id: number;
  name: string;
  type: "text" | "voice";
  created_by: number | null;
  created_at: string;
}

export interface OnlineUser {
  id: number;
  username: string;
  status: UserStatus;
  statusText: string | null;
}

export interface SearchResult {
  id: number;
  channel_id: string;
  username: string;
  raw_username: string;
  content: string;
  created_at: string;
}

export type ServerMessage =
  | { type: "history"; messages: Message[]; hasMore: boolean; oldestId: number | null }
  | { type: "history_prepend"; messages: Message[]; hasMore: boolean; oldestId: number | null }
  | { type: "message"; message: Message }
  | { type: "typing"; userId: number; username: string }
  | { type: "error"; message: string }
  | { type: "presence"; users: OnlineUser[] }
  | { type: "reaction_update"; messageId: number; reactions: Reaction[] }
  | { type: "voice_presence_update"; channelId: string; username: string; action: "join" | "leave" }
  | { type: "voice_state"; channels: Record<string, string[]> }
  | { type: "message_edited"; messageId: number; content: string }
  | { type: "message_deleted"; messageId: number }
  | { type: "pong" }
  | { type: "avatar_update"; userId: number; avatar: string | null }
  | { type: "mention"; channelId: string; senderName: string; content: string }
  | { type: "channel_unread_counts"; counts: Record<string, number> }
  | { type: "channel_unread_increment"; channelName: string }
  | { type: "message_pinned"; messageId: number; channelId: string; pinnedBy: string }
  | { type: "message_unpinned"; messageId: number; channelId: string };

export type ClientMessage =
  | { type: "join"; channelId: string }
  | { type: "load_more"; channelId: string; beforeId: number }
  | { type: "message"; channelId: string; content: string; replyToId?: number | null }
  | { type: "typing"; channelId: string }
  | { type: "react"; messageId: number; emoji: string }
  | { type: "edit_message"; messageId: number; content: string }
  | { type: "delete_message"; messageId: number }
  | { type: "pin_message"; messageId: number; channelId: string }
  | { type: "unpin_message"; messageId: number; channelId: string }
  | { type: "set_status"; status: UserStatus; statusText?: string | null };

export interface Theme {
  name: string;
  primary: string;
  primaryDim: string;
  primaryGlow: string;
  background: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textDim: string;
  error: string;
  gridColor: string;
}

export interface DMConversation {
  id: number;
  other_user_id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
  channelId: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface PinnedMessage {
  id: number;
  content: string;
  username: string;
  created_at: string;
  user_id: number;
  pinned_by_username: string | null;
  pinned_at: string;
}