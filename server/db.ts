import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const dbPath = path.join(process.cwd(), 'lune.db');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys for high performance & integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize Tables
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE COLLATE NOCASE NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT UNIQUE COLLATE NOCASE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      banner TEXT,
      bio TEXT,
      custom_status TEXT,
      presence TEXT DEFAULT 'ONLINE',
      role TEXT DEFAULT 'USER',
      security_pin_hash TEXT,
      last_display_name_change_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      browser TEXT NOT NULL,
      ip TEXT,
      created_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS friendships (
      id TEXT PRIMARY KEY,
      user_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL, -- 'PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED'
      action_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_a_id, user_b_id)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'DM', 'GROUP'
      name TEXT,
      icon TEXT,
      owner_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'MEMBER', -- 'OWNER', 'ADMIN', 'MEMBER'
      joined_at INTEGER NOT NULL,
      last_read_at INTEGER NOT NULL,
      PRIMARY KEY(conversation_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      reply_to_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
      is_pinned INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      edited_at INTEGER,
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS message_reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(message_id, user_id, emoji)
    );

    CREATE TABLE IF NOT EXISTS message_attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      filename TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data TEXT,
      is_read INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      ip TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_friendships_users ON friendships(user_a_id, user_b_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
  `);

  // Seed default admin / showcase account if not exists
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('lander') as { id: string } | undefined;
  if (!existing) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('lander123', salt, 64).toString('hex');
    const fullPasswordHash = `${salt}:${hash}`;

    const userId = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, avatar, bio, custom_status, presence, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      'lander',
      'Pedro Lander',
      'pedro@lune.chat',
      fullPasswordHash,
      '/logo.svg',
      'Criador do LUNE. Y2K Gothic Liquid Glass.',
      'Arquitetando o LUNE 🐈‍⬛',
      'ONLINE',
      'ADMIN',
      now,
      now
    );

    // Seed bot companion account
    const botId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, avatar, bio, custom_status, presence, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      botId,
      'lune_cat',
      'LUNE Core',
      'cat@lune.chat',
      fullPasswordHash,
      '/icon.svg',
      'Guardião do ecossistema LUNE.',
      'Sussurrando na escuridão cromada',
      'ONLINE',
      'ADMIN',
      now,
      now
    );

    // Seed friend connection between lander and lune_cat
    db.prepare(`
      INSERT INTO friendships (id, user_a_id, user_b_id, status, action_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), userId, botId, 'ACCEPTED', userId, now, now);

    // Seed welcoming conversation
    const convId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO conversations (id, type, created_at, updated_at)
      VALUES (?, 'DM', ?, ?)
    `).run(convId, now, now);

    db.prepare(`
      INSERT INTO conversation_members (conversation_id, user_id, role, joined_at, last_read_at)
      VALUES (?, ?, 'MEMBER', ?, ?), (?, ?, 'MEMBER', ?, ?)
    `).run(convId, userId, now, now, convId, botId, now, now);

    // Seed initial message
    db.prepare(`
      INSERT INTO messages (id, conversation_id, author_id, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      convId,
      botId,
      'Bem-vindo ao LUNE. Sua plataforma privada com criptografia P2P, chat persistente, chamadas de voz/vídeo HD e estética Liquid Glass Y2K Gothic.',
      now
    );
  }
}

// Password hashing & verification
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
  } catch {
    return false;
  }
}

export function hashPin(pin: string): string {
  return hashPassword(pin);
}

export function verifyPin(pin: string, storedHash: string): boolean {
  return verifyPassword(pin, storedHash);
}
