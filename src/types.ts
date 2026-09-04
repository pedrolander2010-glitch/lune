// LUNE Full-Stack Types & Models

export type LunePresence = 'ONLINE' | 'IDLE' | 'DO_NOT_DISTURB' | 'GHOST' | 'OFFLINE' | 'STREAMING';

export interface LuneUser {
  id: string;
  username: string; // Unique, case-insensitive (e.g., 'lander' displayed as '@lander')
  displayName: string;
  email: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  customStatus?: string;
  presence: LunePresence;
  role: 'USER' | 'ADMIN';
  lastDisplayNameChangeAt?: string;
  hasSecurityPin?: boolean;
  theme?: string;
  profileEffects?: string;
  createdAt: string;
}

export interface LuneSession {
  id: string;
  userId: string;
  deviceName: string;
  platform: 'desktop' | 'web' | 'mobile';
  browser: string;
  ip: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent?: boolean;
}

export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'BLOCKED';

export interface LuneFriend {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  customStatus?: string;
  presence: LunePresence;
  status: FriendshipStatus;
  isIncoming?: boolean; // For pending requests
  updatedAt: string;
}

export type ConversationType = 'DM' | 'GROUP';

export interface LuneConversation {
  id: string;
  type: ConversationType;
  name?: string;
  icon?: string;
  ownerId?: string;
  members: LuneConversationMember[];
  lastMessage?: LuneMessage;
  unreadCount: number;
  updatedAt: string;
}

export interface LuneConversationMember {
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  presence: LunePresence;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export interface LuneMessage {
  id: string;
  conversationId: string;
  authorId: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    presence: LunePresence;
  };
  content: string;
  replyTo?: {
    id: string;
    authorName: string;
    content: string;
  };
  reactions: LuneReaction[];
  attachments: LuneAttachment[];
  isPinned: boolean;
  createdAt: string;
  editedAt?: string;
}

export interface LuneReaction {
  id: string;
  emoji: string;
  count: number;
  users: string[]; // usernames or userIds
}

export interface LuneAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface LuneGif {
  id: string;
  title: string;
  tags: string[];
  url: string;
  thumbnailUrl: string;
  isGlobal: boolean;
  isFavorite?: boolean;
}

export interface LuneEmoji {
  id: string;
  name: string;
  url: string;
  isAnimated: boolean;
}

export interface LuneNotification {
  id: string;
  type: 'MESSAGE' | 'FRIEND_REQUEST' | 'FRIEND_ACCEPTED' | 'CALL' | 'GROUP_INVITE' | 'SYSTEM';
  title: string;
  body: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export interface LuneAuditLog {
  id: string;
  userId: string;
  action: string;
  details: string;
  createdAt: string;
}

// WebRTC & Audio/Video Call Types
export interface ActiveCallState {
  id: string;
  conversationId: string;
  type: 'voice' | 'video' | 'screen';
  channelName: string;
  isInitiator: boolean;
  remoteUser?: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  };
  isMicMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  fps: 30 | 60;
  quality: '720p' | '1080p';
  durationSeconds: number;
  status: 'calling' | 'connected' | 'ended';
}

// Preserving existing helper types for fallback P2P screen share rooms
export interface UserInfo {
  id: string;
  name: string;
  tag: string;
  avatarColor: string;
}

export interface StreamConfig {
  fps: 30 | 60;
  resolution: '1080p' | '720p' | '480p';
  captureAudio: boolean;
}

export interface AppSettings {
  darkMode: boolean;
  theme?: 'LUNE' | 'OLED' | 'Graphite' | 'Liquid' | 'Y2K_Gothic';
  blurIntensity?: 'low' | 'medium' | 'high';
  reducedEffects?: boolean;
  preferredFps: 30 | 60;
  preferredResolution: '1080p' | '720p' | '480p';
  roomEncryptionKey?: string;
  pushNotificationsEnabled: boolean;
  soundAlertsEnabled: boolean;
  soundVolume: number;
  noiseSuppression: boolean;
  echoCancellation: boolean;
}

export interface IncomingCall {
  fromUser: UserInfo;
  roomId: string;
  timestamp: number;
}

export interface Friend {
  id: string;
  name: string;
  tag: string;
  avatarColor: string;
  status: 'online' | 'offline' | 'in-call';
}

export interface FriendRequest {
  id: string;
  fromUser: UserInfo;
  timestamp: number;
}

export interface NetworkMetrics {
  rttMs: number;
  packetLossPercent?: number;
  fps?: number;
  currentFps?: number;
  packetsLost?: number;
  bitrateKbps?: number;
  jitterMs?: number;
  bytesReceived?: number;
  bytesSent?: number;
}

export interface ChatMessage {
  id: string;
  roomId?: string;
  sender?: UserInfo;
  senderId?: string;
  senderName?: string;
  senderTag?: string;
  avatarColor?: string;
  text?: string;
  encryptedText?: string;
  decryptedText?: string;
  timestamp: number;
  isEncrypted: boolean;
}

export interface SharedFile {
  id: string;
  name: string;
  size: number;
  type?: string;
  mimeType?: string;
  sender?: UserInfo;
  senderName?: string;
  progress: number;
  status?: 'pending' | 'transferring' | 'completed' | 'error';
  isComplete?: boolean;
  dataUrl?: string;
  timestamp: number;
}


