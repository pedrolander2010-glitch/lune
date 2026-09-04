import { createClient } from '@supabase/supabase-js';
import {
  LuneUser,
  LuneFriend,
  LuneConversation,
  LuneConversationMember,
  LuneMessage,
  LunePresence,
} from '../types';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export function isSupabaseConfigured(): boolean {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('your-project.supabase.co') &&
    SUPABASE_ANON_KEY !== 'your-anon-key' &&
    SUPABASE_URL.startsWith('http')
  );
}

// Database Row Types matching Supabase PostgreSQL Schema
export interface ProfileRow {
  id: string;
  username: string;
  username_normalized: string;
  display_name: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  custom_status?: string | null;
  presence_status?: LunePresence | null;
  security_pin_hash?: string | null;
  last_display_name_change_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FriendRequestRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  updated_at: string;
  sender?: ProfileRow;
  receiver?: ProfileRow;
}

export interface FriendshipRow {
  id: string;
  user_low: string;
  user_high: string;
  created_at: string;
}

export interface ConversationRow {
  id: string;
  type: 'direct' | 'group';
  name?: string | null;
  icon_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMemberRow {
  conversation_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profile?: ProfileRow;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  reply_to_id?: string | null;
  attachments?: any;
  is_pinned?: boolean;
  reactions?: any;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  sender?: ProfileRow;
}

export interface BlockRow {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string; username: string; username_normalized: string; display_name: string };
        Update: Partial<ProfileRow>;
      };
      friend_requests: {
        Row: FriendRequestRow;
        Insert: Partial<FriendRequestRow> & { sender_id: string; receiver_id: string };
        Update: Partial<FriendRequestRow>;
      };
      friendships: {
        Row: FriendshipRow;
        Insert: { user_low: string; user_high: string };
        Update: Partial<FriendshipRow>;
      };
      blocks: {
        Row: BlockRow;
        Insert: { blocker_id: string; blocked_id: string };
        Update: Partial<BlockRow>;
      };
      conversations: {
        Row: ConversationRow;
        Insert: Partial<ConversationRow>;
        Update: Partial<ConversationRow>;
      };
      conversation_members: {
        Row: ConversationMemberRow;
        Insert: { conversation_id: string; user_id: string; role?: 'owner' | 'admin' | 'member' };
        Update: Partial<ConversationMemberRow>;
      };
      messages: {
        Row: MessageRow;
        Insert: Partial<MessageRow> & { conversation_id: string; sender_id: string };
        Update: Partial<MessageRow>;
      };
      user_saved_gifs: {
        Row: { id: string; user_id: string; gif_url: string; title: string | null; created_at: string };
        Insert: { user_id: string; gif_url: string; title?: string | null };
        Update: { gif_url?: string; title?: string | null };
      };
    };
    Functions: {
      accept_friend_request: {
        Args: { p_request_id: string };
        Returns: { success: boolean; error?: string; friendship_id?: string };
      };
      remove_friend: {
        Args: { p_target_user_id: string };
        Returns: { success: boolean; error?: string };
      };
      get_or_create_direct_conversation: {
        Args: { p_target_user_id: string };
        Returns: string;
      };
      change_display_name: {
        Args: { p_new_name: string; p_security_pin?: string };
        Returns: { success: boolean; error?: string; display_name?: string; cooldown_left_seconds?: number };
      };
    };
  };
}

// Supabase Singleton Client
export const supabase = createClient(
  isSupabaseConfigured() ? SUPABASE_URL : 'https://placeholder.supabase.co',
  isSupabaseConfigured() ? SUPABASE_ANON_KEY : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 20,
      },
    },
  }
);

// Helpers to map Database Rows to UI Domain Types
export function mapProfileToLuneUser(profile: ProfileRow, email = ''): LuneUser {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name || profile.username,
    email: email || '',
    avatar: profile.avatar_url || undefined,
    banner: profile.banner_url || undefined,
    bio: profile.bio || undefined,
    customStatus: profile.custom_status || undefined,
    presence: (profile.presence_status as LunePresence) || 'ONLINE',
    role: 'USER',
    lastDisplayNameChangeAt: profile.last_display_name_change_at || undefined,
    hasSecurityPin: Boolean(profile.security_pin_hash),
    createdAt: profile.created_at,
  };
}

// Remote Global User Search
export async function searchProfilesByUsername(query: string, currentUserId?: string): Promise<LuneUser[]> {
  if (!isSupabaseConfigured()) return [];
  const clean = query.trim().toLowerCase().replace(/^@/, '');
  if (!clean || clean.length < 2) return [];

  let req = supabase
    .from('profiles')
    .select('*')
    .or(`username_normalized.ilike.%${clean}%,display_name.ilike.%${clean}%`)
    .limit(20);

  if (currentUserId) {
    req = req.neq('id', currentUserId);
  }

  const { data, error } = await req;
  if (error || !data) {
    console.error('Error searching profiles:', error);
    return [];
  }

  return (data as ProfileRow[]).map((p) => mapProfileToLuneUser(p));
}

// Fetch User Friends & Requests
export async function fetchUserSocialData(userId: string): Promise<{
  friends: LuneFriend[];
  incomingRequests: LuneFriend[];
  outgoingRequests: LuneFriend[];
  blockedUsers: LuneFriend[];
}> {
  if (!isSupabaseConfigured() || !userId) {
    return { friends: [], incomingRequests: [], outgoingRequests: [], blockedUsers: [] };
  }

  try {
    // 1. Fetch Friendships
    const { data: friendshipsData } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_low.eq.${userId},user_high.eq.${userId}`);

    const friendUserIds: string[] = [];
    if (friendshipsData) {
      for (const f of friendshipsData as FriendshipRow[]) {
        const otherId = f.user_low === userId ? f.user_high : f.user_low;
        friendUserIds.push(otherId);
      }
    }

    // 2. Fetch Friend Requests
    const { data: requestsData } = await supabase
      .from('friend_requests')
      .select('*, sender:profiles!friend_requests_sender_id_fkey(*), receiver:profiles!friend_requests_receiver_id_fkey(*)')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', 'pending');

    // 3. Fetch Blocks
    const { data: blocksData } = await supabase
      .from('blocks')
      .select('*, blocked:profiles!blocks_blocked_id_fkey(*)')
      .eq('blocker_id', userId);

    // 4. Fetch Friend Profiles in batch
    let friendProfiles: ProfileRow[] = [];
    if (friendUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', friendUserIds);
      friendProfiles = (profiles as ProfileRow[]) || [];
    }

    const friends: LuneFriend[] = friendProfiles.map((p) => ({
      id: p.id,
      userId: p.id,
      username: p.username,
      displayName: p.display_name,
      avatar: p.avatar_url || undefined,
      customStatus: p.custom_status || undefined,
      presence: (p.presence_status as LunePresence) || 'OFFLINE',
      status: 'ACCEPTED',
      updatedAt: p.updated_at,
    }));

    const incomingRequests: LuneFriend[] = [];
    const outgoingRequests: LuneFriend[] = [];

    if (requestsData) {
      for (const r of requestsData as any[]) {
        if (r.receiver_id === userId && r.sender) {
          incomingRequests.push({
            id: r.id, // friend request id for accepting/declining
            userId: r.sender.id,
            username: r.sender.username,
            displayName: r.sender.display_name,
            avatar: r.sender.avatar_url || undefined,
            customStatus: r.sender.custom_status || undefined,
            presence: (r.sender.presence_status as LunePresence) || 'OFFLINE',
            status: 'PENDING',
            isIncoming: true,
            updatedAt: r.updated_at,
          });
        } else if (r.sender_id === userId && r.receiver) {
          outgoingRequests.push({
            id: r.id,
            userId: r.receiver.id,
            username: r.receiver.username,
            displayName: r.receiver.display_name,
            avatar: r.receiver.avatar_url || undefined,
            customStatus: r.receiver.custom_status || undefined,
            presence: (r.receiver.presence_status as LunePresence) || 'OFFLINE',
            status: 'PENDING',
            isIncoming: false,
            updatedAt: r.updated_at,
          });
        }
      }
    }

    const blockedUsers: LuneFriend[] = [];
    if (blocksData) {
      for (const b of blocksData as any[]) {
        if (b.blocked) {
          blockedUsers.push({
            id: b.blocked_id,
            userId: b.blocked_id,
            username: b.blocked.username,
            displayName: b.blocked.display_name,
            avatar: b.blocked.avatar_url || undefined,
            presence: 'OFFLINE',
            status: 'BLOCKED',
            updatedAt: b.created_at,
          });
        }
      }
    }

    return { friends, incomingRequests, outgoingRequests, blockedUsers };
  } catch (err) {
    console.error('Failed to fetch user social data:', err);
    return { friends: [], incomingRequests: [], outgoingRequests: [], blockedUsers: [] };
  }
}

// Send Friend Request
export async function sendFriendRequest(senderId: string, receiverId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Backend is not configured.' };
  if (senderId === receiverId) return { success: false, error: 'Não é possível adicionar a si mesmo.' };

  try {
    const { error } = await supabase
      .from('friend_requests')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        status: 'pending',
      });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Um pedido de amizade já está pendente.' };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao enviar pedido.' };
  }
}

// Accept Friend Request via Atomic RPC
export async function acceptFriendRequestRpc(requestId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Backend is not configured.' };

  try {
    const { data, error } = await supabase.rpc('accept_friend_request', {
      p_request_id: requestId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const res = data as any;
    if (!res?.success) {
      return { success: false, error: res?.error || 'Erro ao aceitar pedido.' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro inesperado.' };
  }
}

// Decline / Cancel Friend Request
export async function updateFriendRequestStatus(requestId: string, status: 'declined' | 'cancelled'): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Backend is not configured.' };

  try {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao atualizar pedido.' };
  }
}

// Remove Friend via RPC
export async function removeFriendRpc(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Backend is not configured.' };

  try {
    const { data, error } = await supabase.rpc('remove_friend', {
      p_target_user_id: targetUserId,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao desfazer amizade.' };
  }
}

// Block User
export async function blockUser(blockerId: string, blockedId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Backend is not configured.' };

  try {
    // 1. Remove any friendship
    await removeFriendRpc(blockedId);

    // 2. Insert block
    const { error } = await supabase
      .from('blocks')
      .insert({ blocker_id: blockerId, blocked_id: blockedId });

    if (error && error.code !== '23505') {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao bloquear usuário.' };
  }
}

// Unblock User
export async function unblockUser(blockerId: string, blockedId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Backend is not configured.' };

  try {
    const { error } = await supabase
      .from('blocks')
      .delete()
      .match({ blocker_id: blockerId, blocked_id: blockedId });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao desbloquear.' };
  }
}

// Conversations & Messaging
export async function fetchUserConversations(currentUserId: string): Promise<LuneConversation[]> {
  if (!isSupabaseConfigured() || !currentUserId) return [];

  try {
    // Fetch memberships for current user
    const { data: myMemberships } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', currentUserId);

    if (!myMemberships || myMemberships.length === 0) return [];

    const convIds = myMemberships.map((m) => m.conversation_id);

    // Fetch conversations with all members and their profiles
    const { data: convs } = await supabase
      .from('conversations')
      .select(`
        *,
        members:conversation_members (
          user_id,
          role,
          profile:profiles (*)
        )
      `)
      .in('id', convIds)
      .order('updated_at', { ascending: false });

    if (!convs) return [];

    const result: LuneConversation[] = [];

    for (const c of convs as any[]) {
      const members: LuneConversationMember[] = (c.members || []).map((m: any) => ({
        userId: m.user_id,
        username: m.profile?.username || 'user',
        displayName: m.profile?.display_name || m.profile?.username || 'Usuário',
        avatar: m.profile?.avatar_url || undefined,
        presence: (m.profile?.presence_status as LunePresence) || 'OFFLINE',
        role: (m.role?.toUpperCase() as any) || 'MEMBER',
      }));

      // Fetch latest message
      const { data: latestMsg } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(*)')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let lastMessage: LuneMessage | undefined = undefined;
      if (latestMsg) {
        lastMessage = {
          id: latestMsg.id,
          conversationId: latestMsg.conversation_id,
          authorId: latestMsg.sender_id,
          author: {
            id: latestMsg.sender?.id || latestMsg.sender_id,
            username: latestMsg.sender?.username || 'user',
            displayName: latestMsg.sender?.display_name || 'Usuário',
            avatar: latestMsg.sender?.avatar_url || undefined,
            presence: (latestMsg.sender?.presence_status as LunePresence) || 'OFFLINE',
          },
          content: latestMsg.content || '',
          reactions: latestMsg.reactions || [],
          attachments: latestMsg.attachments || [],
          isPinned: Boolean(latestMsg.is_pinned),
          createdAt: latestMsg.created_at,
          editedAt: latestMsg.edited_at || undefined,
        };
      }

      result.push({
        id: c.id,
        type: c.type === 'direct' ? 'DM' : 'GROUP',
        name: c.name || undefined,
        icon: c.icon_url || undefined,
        members,
        lastMessage,
        unreadCount: 0,
        updatedAt: c.updated_at,
      });
    }

    return result;
  } catch (err) {
    console.error('Failed to fetch user conversations:', err);
    return [];
  }
}

// Get or Create Direct Conversation
export async function getOrCreateDirectConversation(targetUserId: string): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('Remote backend is not configured.');

  const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
    p_target_user_id: targetUserId,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Falha ao iniciar conversa direta.');
  }

  return data;
}

// Fetch Messages in a Conversation
export async function fetchConversationMessages(
  conversationId: string,
  limit = 50,
  beforeTimestamp?: string
): Promise<LuneMessage[]> {
  if (!isSupabaseConfigured()) return [];

  let query = supabase
    .from('messages')
    .select('*, sender:profiles!messages_sender_id_fkey(*)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (beforeTimestamp) {
    query = query.lt('created_at', beforeTimestamp);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error('Error fetching messages:', error);
    return [];
  }

  // Map to domain type and reverse so oldest is first in view
  const list: LuneMessage[] = (data as any[]).map((m) => ({
    id: m.id,
    conversationId: m.conversation_id,
    authorId: m.sender_id,
    author: {
      id: m.sender?.id || m.sender_id,
      username: m.sender?.username || 'user',
      displayName: m.sender?.display_name || 'Usuário',
      avatar: m.sender?.avatar_url || undefined,
      presence: (m.sender?.presence_status as LunePresence) || 'OFFLINE',
    },
    content: m.content || '',
    replyTo: undefined,
    reactions: m.reactions || [],
    attachments: m.attachments || [],
    isPinned: Boolean(m.is_pinned),
    createdAt: m.created_at,
    editedAt: m.edited_at || undefined,
  }));

  return list.reverse();
}

// Send Message
export async function sendRemoteMessage(
  conversationId: string,
  senderId: string,
  content: string,
  replyToId?: string,
  attachments: any[] = []
): Promise<LuneMessage> {
  if (!isSupabaseConfigured()) throw new Error('Remote backend is not configured.');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      reply_to_id: replyToId || null,
      attachments,
    })
    .select('*, sender:profiles!messages_sender_id_fkey(*)')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Falha ao enviar mensagem.');
  }

  // Update conversation timestamp
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  const m: any = data;
  return {
    id: m.id,
    conversationId: m.conversation_id,
    authorId: m.sender_id,
    author: {
      id: m.sender?.id || m.sender_id,
      username: m.sender?.username || 'user',
      displayName: m.sender?.display_name || 'Usuário',
      avatar: m.sender?.avatar_url || undefined,
      presence: (m.sender?.presence_status as LunePresence) || 'OFFLINE',
    },
    content: m.content || '',
    reactions: m.reactions || [],
    attachments: m.attachments || [],
    isPinned: Boolean(m.is_pinned),
    createdAt: m.created_at,
  };
}

// Update Display Name via Cooldown-Enforced RPC
export async function updateDisplayNameRpc(
  newName: string,
  securityPin?: string
): Promise<{ success: boolean; error?: string; displayName?: string; cooldownLeftSeconds?: number }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Remote backend is not configured.' };

  try {
    const { data, error } = await supabase.rpc('change_display_name', {
      p_new_name: newName,
      p_security_pin: securityPin || undefined,
    });

    if (error) return { success: false, error: error.message };

    const res = data as any;
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Erro ao alterar nome de exibição.',
        cooldownLeftSeconds: res.cooldown_left_seconds,
      };
    }

    return { success: true, displayName: res.display_name };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro de conexão.' };
  }
}

// Saved GIFs
export async function fetchUserSavedGifs(userId: string): Promise<string[]> {
  if (!isSupabaseConfigured() || !userId) return [];

  const { data } = await supabase
    .from('user_saved_gifs')
    .select('gif_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!data) return [];
  return data.map((item) => item.gif_url);
}

export async function saveUserGif(userId: string, gifUrl: string, title?: string): Promise<void> {
  if (!isSupabaseConfigured() || !userId || !gifUrl) return;

  await supabase
    .from('user_saved_gifs')
    .insert({ user_id: userId, gif_url: gifUrl, title })
    .select('id')
    .maybeSingle();
}

export async function removeUserSavedGif(userId: string, gifUrl: string): Promise<void> {
  if (!isSupabaseConfigured() || !userId || !gifUrl) return;

  await supabase
    .from('user_saved_gifs')
    .delete()
    .match({ user_id: userId, gif_url: gifUrl });
}

// Storage: Upload Avatar to Supabase Storage Bucket
export async function uploadAvatarFile(userId: string, file: File): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('Remote backend is not configured.');

  const ext = file.name.split('.').pop() || 'png';
  const filePath = `avatars/${userId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('lune-media')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    throw new Error(`Falha no upload do avatar: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('lune-media').getPublicUrl(filePath);
  const publicUrl = data.publicUrl;

  // Update profile
  await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', userId);

  return publicUrl;
}
