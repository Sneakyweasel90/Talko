export interface Stats {
  totalUsers: number;
  totalMessages: number;
  totalCommunities: number;
  bannedUsers: number;
  messagesLast24h: number;
  newUsersLast7d: number;
}

export interface ChartPoint {
  day: string;
  count: number;
}

export interface AdminUser {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
  role: string;
  custom_role_name: string | null;
  banned_at: string | null;
  kicked_until: string | null;
  created_at: string;
}

export interface AdminCommunity {
  id: number;
  name: string;
  icon: string | null;
  owner_username: string;
  member_count: number;
  channel_count: number;
  message_count: number;
  created_at: string;
}

export interface UserMessage {
  id: number;
  content: string;
  created_at: string;
  edited_at: string | null;
  channel_id: string;
  channel_name: string | null;
  community_name: string | null;
  community_id: number | null;
}

export interface CommunityMember {
  user_id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
  joined_at: string;
}

export interface AuditLogEntry {
  id: number;
  admin_username: string;
  action: string;
  target_type: string | null;
  target_id: number | null;
  target_name: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export type NavSection = "overview" | "users" | "communities" | "audit";
