-- ==============================================================================
-- LUNE REMOTE POSTGRESQL SCHEMA & REALTIME INFRASTRUCTURE (SUPABASE)
-- Multi-User Social Communication Platform
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles Table (Linked directly to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  username_normalized TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  custom_status TEXT,
  presence_status TEXT DEFAULT 'OFFLINE' CHECK (presence_status IN ('ONLINE', 'IDLE', 'DO_NOT_DISTURB', 'GHOST', 'OFFLINE')),
  security_pin_hash TEXT,
  last_display_name_change_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT username_length_check CHECK (char_length(username) >= 3 AND char_length(username) <= 24),
  CONSTRAINT username_chars_check CHECK (username ~ '^[a-zA-Z0-9_.]+$'),
  CONSTRAINT display_name_length_check CHECK (char_length(display_name) >= 1 AND char_length(display_name) <= 32)
);

-- Unique normalized username (Case-insensitive: Lander, lander, LANDER conflict)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_normalized ON public.profiles (username_normalized);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm ON public.profiles (username_normalized text_pattern_ops);

-- 3. Friend Requests Table
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT no_self_friend_request CHECK (sender_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests (sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests (receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON public.friend_requests (status);
-- Prevent duplicate pending requests between the same users in the same direction
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_friend_request 
  ON public.friend_requests (sender_id, receiver_id) 
  WHERE status = 'pending';

-- 4. Friendships Table (Canonical pair: user_low < user_high)
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_high UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT user_low_less_than_high CHECK (user_low < user_high),
  CONSTRAINT unique_friendship_pair UNIQUE (user_low, user_high)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_low ON public.friendships (user_low);
CREATE INDEX IF NOT EXISTS idx_friendships_user_high ON public.friendships (user_high);

-- 5. User Blocks Table
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks (blocked_id);

-- 6. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('direct', 'group')) DEFAULT 'direct',
  name TEXT,
  icon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. Conversation Members Table
CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON public.conversation_members (user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conv ON public.conversation_members (conversation_id);

-- 8. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_pinned BOOLEAN DEFAULT false,
  reactions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
  ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages (sender_id);

-- 9. Saved / Favorite GIFs
CREATE TABLE IF NOT EXISTS public.user_saved_gifs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gif_url TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT unique_user_gif UNIQUE (user_id, gif_url)
);

CREATE INDEX IF NOT EXISTS idx_user_saved_gifs_user ON public.user_saved_gifs (user_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved_gifs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Friend Requests Policies
CREATE POLICY "Users can view friend requests they sent or received"
  ON public.friend_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send friend requests"
  ON public.friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND sender_id <> receiver_id
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks
      WHERE (blocker_id = receiver_id AND blocked_id = sender_id)
         OR (blocker_id = sender_id AND blocked_id = receiver_id)
    )
  );

CREATE POLICY "Users can update status of requests they are part of"
  ON public.friend_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id)
  WITH CHECK (auth.uid() = receiver_id OR auth.uid() = sender_id);

CREATE POLICY "Users can delete their own sent or received requests"
  ON public.friend_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Friendships Policies
CREATE POLICY "Users can view friendships they are member of"
  ON public.friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = user_low OR auth.uid() = user_high);

CREATE POLICY "Users can delete their own friendship"
  ON public.friendships FOR DELETE
  TO authenticated
  USING (auth.uid() = user_low OR auth.uid() = user_high);

-- Blocks Policies
CREATE POLICY "Users can view their own blocks"
  ON public.blocks FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create blocks"
  ON public.blocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete their own blocks"
  ON public.blocks FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_id);

-- Conversations Policies
CREATE POLICY "Users can view conversations they belong to"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversations.id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Conversation Members Policies
CREATE POLICY "Members can view other members of their conversations"
  ON public.conversation_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add members or join conversations"
  ON public.conversation_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id AND cm.user_id = auth.uid()
    )
  );

-- Messages Policies
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = messages.conversation_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = messages.conversation_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Senders can edit their own messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Senders can delete their own messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

-- Saved GIFs Policies
CREATE POLICY "Users can view their saved GIFs"
  ON public.user_saved_gifs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can save GIFs"
  ON public.user_saved_gifs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their saved GIFs"
  ON public.user_saved_gifs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ==============================================================================
-- DATABASE FUNCTIONS / STORED PROCEDURES (TRANSACTION ATOMICITY)
-- ==============================================================================

-- 1. Atomic Friend Request Acceptance
CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_sender_id UUID;
  v_receiver_id UUID;
  v_status TEXT;
  v_low UUID;
  v_high UUID;
  v_friendship_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated');
  END IF;

  -- 1. Lock and fetch friend request
  SELECT sender_id, receiver_id, status
  INTO v_sender_id, v_receiver_id, v_status
  FROM public.friend_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  -- 2. Verify caller is receiver
  IF v_receiver_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to accept this request');
  END IF;

  -- 3. Verify status is pending
  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is not pending');
  END IF;

  -- 4. Verify no block exists
  IF EXISTS (
    SELECT 1 FROM public.blocks 
    WHERE (blocker_id = v_sender_id AND blocked_id = v_receiver_id)
       OR (blocker_id = v_receiver_id AND blocked_id = v_sender_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Action blocked by user block settings');
  END IF;

  -- 5. Canonicalize friendship pair
  IF v_sender_id < v_receiver_id THEN
    v_low := v_sender_id;
    v_high := v_receiver_id;
  ELSE
    v_low := v_receiver_id;
    v_high := v_sender_id;
  END IF;

  -- 6. Insert into friendships table
  INSERT INTO public.friendships (user_low, user_high)
  VALUES (v_low, v_high)
  ON CONFLICT (user_low, user_high) DO NOTHING
  RETURNING id INTO v_friendship_id;

  -- 7. Update request status to accepted
  UPDATE public.friend_requests
  SET status = 'accepted', updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'friendship_id', v_friendship_id);
END;
$$;

-- 2. Remove Friendship Atomically
CREATE OR REPLACE FUNCTION public.remove_friend(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_low UUID;
  v_high UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated');
  END IF;

  IF v_caller_id < p_target_user_id THEN
    v_low := v_caller_id;
    v_high := p_target_user_id;
  ELSE
    v_low := p_target_user_id;
    v_high := v_caller_id;
  END IF;

  DELETE FROM public.friendships
  WHERE user_low = v_low AND user_high = v_high;

  -- Clean up any lingering accepted request rows
  UPDATE public.friend_requests
  SET status = 'declined', updated_at = now()
  WHERE (sender_id = v_caller_id AND receiver_id = p_target_user_id)
     OR (sender_id = p_target_user_id AND receiver_id = v_caller_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Get or Create Direct Conversation Atomically
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(p_target_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_conv_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  IF v_caller_id = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot start DM with yourself';
  END IF;

  -- Look for existing 2-member direct conversation
  SELECT c.id INTO v_conv_id
  FROM public.conversations c
  JOIN public.conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = v_caller_id
  JOIN public.conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = p_target_user_id
  WHERE c.type = 'direct'
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- Create new direct conversation
  INSERT INTO public.conversations (type)
  VALUES ('direct')
  RETURNING id INTO v_conv_id;

  -- Add both members
  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES 
    (v_conv_id, v_caller_id, 'member'),
    (v_conv_id, p_target_user_id, 'member');

  RETURN v_conv_id;
END;
$$;

-- 4. Change Display Name with Server-Enforced 7-day Cooldown
CREATE OR REPLACE FUNCTION public.change_display_name(p_new_name TEXT, p_security_pin TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_last_change TIMESTAMPTZ;
  v_pin_hash TEXT;
  v_clean_name TEXT;
  v_cooldown_left INTERVAL;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated');
  END IF;

  v_clean_name := trim(p_new_name);
  IF char_length(v_clean_name) < 1 OR char_length(v_clean_name) > 32 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Display name must be between 1 and 32 characters');
  END IF;

  SELECT last_display_name_change_at, security_pin_hash
  INTO v_last_change, v_pin_hash
  FROM public.profiles
  WHERE id = v_caller_id;

  -- Check 7-day cooldown
  IF v_last_change IS NOT NULL AND now() < (v_last_change + INTERVAL '7 days') THEN
    -- If security PIN is provided and valid, allow bypass
    IF p_security_pin IS NOT NULL AND v_pin_hash IS NOT NULL AND crypt(p_security_pin, v_pin_hash) = v_pin_hash THEN
      -- Valid PIN bypasses cooldown
    ELSE
      v_cooldown_left := (v_last_change + INTERVAL '7 days') - now();
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Display name change cooldown in effect. 7 days required between changes.',
        'cooldown_left_seconds', EXTRACT(EPOCH FROM v_cooldown_left)::INT
      );
    END IF;
  END IF;

  UPDATE public.profiles
  SET display_name = v_clean_name,
      last_display_name_change_at = now(),
      updated_at = now()
  WHERE id = v_caller_id;

  RETURN jsonb_build_object('success', true, 'display_name', v_clean_name);
END;
$$;

-- 5. Auto-sync auth.users creation trigger (optional convenience)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_display_name TEXT;
BEGIN
  v_username := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  v_display_name := COALESCE(new.raw_user_meta_data->>'display_name', v_username);

  INSERT INTO public.profiles (id, username, username_normalized, display_name, avatar_url)
  VALUES (
    new.id,
    v_username,
    lower(v_username),
    v_display_name,
    COALESCE(new.raw_user_meta_data->>'avatar_url', '/logo.svg')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- REALTIME PUBLICATION SETUP
-- ==============================================================================
-- Add all core social and messaging tables to Supabase Realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
  EXCEPTION WHEN duplicate_object THEN END;
END $$;
