import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { db, initDatabase, hashPassword, verifyPassword, hashPin, verifyPin } from './server/db.js';

// Initialize SQLite schema & seed records
initDatabase();

const app = express();
const PORT = 3000;
const server = http.createServer(app);

// Middleware
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// In-memory WebSocket user mapping: userId -> Set<WebSocket>
const connectedUsers = new Map<string, Set<WebSocket>>();
const socketToUser = new Map<WebSocket, { userId: string; username: string; sessionId: string }>();

// WebRTC Rooms for Screen Share & Group/Direct Voice/Video Mesh
const rooms = new Map<string, Map<string, { ws: WebSocket; user: any }>>();
const socketRooms = new Map<WebSocket, Set<string>>();

// Simple rate limiter for sensitive endpoints
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxAttempts = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count += 1;
  return true;
}

// Authentication middleware
interface AuthRequest extends Request {
  user?: any;
  session?: any;
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Autenticação necessária.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const session = db.prepare(`
      SELECT s.*, u.id as user_id, u.username, u.display_name, u.email, u.avatar, u.banner,
             u.bio, u.custom_status, u.presence, u.role, u.security_pin_hash,
             u.last_display_name_change_at, u.created_at as user_created_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > ?
    `).get(token, Date.now()) as any;

    if (!session) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Sessão inválida ou expirada.' });
    }

    // Update session last active time
    db.prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?').run(Date.now(), token);

    req.session = session;
    req.user = {
      id: session.user_id,
      username: session.username,
      displayName: session.display_name,
      email: session.email,
      avatar: session.avatar,
      banner: session.banner,
      bio: session.bio,
      customStatus: session.custom_status,
      presence: session.presence,
      role: session.role,
      hasSecurityPin: Boolean(session.security_pin_hash),
      lastDisplayNameChangeAt: session.last_display_name_change_at ? new Date(session.last_display_name_change_at).toISOString() : null,
      createdAt: new Date(session.user_created_at).toISOString(),
    };
    next();
  } catch (err) {
    console.error('Auth check error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao verificar autenticação.' });
  }
}

// Helper to broadcast WS messages to a specific user
function sendToUser(userId: string, type: string, payload: any) {
  const sockets = connectedUsers.get(userId);
  if (sockets && sockets.size > 0) {
    const msg = JSON.stringify({ type, payload });
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
    return true;
  }
  return false;
}

// Helper to broadcast to members of a conversation
function broadcastToConversation(conversationId: string, type: string, payload: any, excludeUserId?: string) {
  try {
    const members = db.prepare('SELECT user_id FROM conversation_members WHERE conversation_id = ?').all(conversationId) as { user_id: string }[];
    for (const member of members) {
      if (member.user_id !== excludeUserId) {
        sendToUser(member.user_id, type, payload);
      }
    }
  } catch (err) {
    console.error('Error broadcasting to conversation:', err);
  }
}

// ======================== AUTH ENDPOINTS ========================

// Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'LUNE',
    activeUsers: connectedUsers.size,
    timestamp: Date.now(),
  });
});

// Register
app.post('/api/auth/register', (req, res) => {
  const ip = req.ip || '127.0.0.1';
  if (!checkRateLimit(`register:${ip}`, 5, 60000)) {
    return res.status(429).json({ error: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente em instantes.' });
  }

  const { displayName, username, email, password, avatar } = req.body;

  if (!displayName || !username || !email || !password) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Preencha todos os campos obrigatórios.' });
  }

  // Validate username
  const cleanUsername = String(username).trim().toLowerCase().replace(/^@/, '');
  if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
    return res.status(400).json({
      error: 'INVALID_USERNAME',
      message: 'O username deve ter entre 3 e 24 caracteres (letras, números e underline).',
    });
  }

  // Validate password length
  if (password.length < 6) {
    return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  try {
    // Check if username exists (case-insensitive)
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(cleanUsername);
    if (existingUser) {
      return res.status(409).json({ error: 'USERNAME_TAKEN', message: 'Este @username já está em uso.' });
    }

    // Check if email exists
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email.trim().toLowerCase());
    if (existingEmail) {
      return res.status(409).json({ error: 'EMAIL_TAKEN', message: 'Este e-mail já está cadastrado.' });
    }

    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(password);
    const now = Date.now();

    db.prepare(`
      INSERT INTO users (id, username, display_name, email, password_hash, avatar, presence, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'ONLINE', 'USER', ?, ?)
    `).run(
      userId,
      cleanUsername,
      String(displayName).trim().slice(0, 32),
      email.trim().toLowerCase(),
      passwordHash,
      avatar || '/logo.svg',
      now,
      now
    );

    // Create initial session
    const sessionId = crypto.randomUUID();
    const userAgent = req.headers['user-agent'] || 'Web Browser';
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

    db.prepare(`
      INSERT INTO sessions (id, user_id, device_name, platform, browser, ip, created_at, last_active_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, userId, 'Navegador Web', 'web', userAgent.slice(0, 48), ip, now, now, expiresAt);

    // Also connect with LUNE Cat bot automatically as first friend!
    const bot = db.prepare('SELECT id FROM users WHERE username = ?').get('lune_cat') as { id: string } | undefined;
    if (bot) {
      db.prepare(`
        INSERT OR IGNORE INTO friendships (id, user_a_id, user_b_id, status, action_user_id, created_at, updated_at)
        VALUES (?, ?, ?, 'ACCEPTED', ?, ?, ?)
      `).run(crypto.randomUUID(), userId, bot.id, userId, now, now);

      const convId = crypto.randomUUID();
      db.prepare("INSERT INTO conversations (id, type, created_at, updated_at) VALUES (?, 'DM', ?, ?)").run(convId, now, now);
      db.prepare("INSERT INTO conversation_members (conversation_id, user_id, role, joined_at, last_read_at) VALUES (?, ?, 'MEMBER', ?, ?), (?, ?, 'MEMBER', ?, ?)").run(convId, userId, now, now, convId, bot.id, now, now);
      db.prepare('INSERT INTO messages (id, conversation_id, author_id, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
        crypto.randomUUID(),
        convId,
        bot.id,
        `Olá @${cleanUsername}! Seja bem-vindo ao LUNE. Sinta-se à vontade para enviar mensagens, testar o seletor de GIFs/emojis, chamar amigos para chamadas de voz e compartilhar sua tela em 60 FPS! 🐈‍⬛✨`,
        now
      );
    }

    res.json({
      token: sessionId,
      user: {
        id: userId,
        username: cleanUsername,
        displayName: String(displayName).trim().slice(0, 32),
        email: email.trim().toLowerCase(),
        avatar: avatar || '/logo.svg',
        presence: 'ONLINE',
        role: 'USER',
        hasSecurityPin: false,
        createdAt: new Date(now).toISOString(),
      },
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Falha ao registrar conta.' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || '127.0.0.1';
  if (!checkRateLimit(`login:${ip}`, 10, 60000)) {
    return res.status(429).json({ error: 'RATE_LIMITED', message: 'Muitas tentativas de login. Aguarde um minuto.' });
  }

  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Informe login e senha.' });
  }

  const cleanLogin = String(login).trim().toLowerCase().replace(/^@/, '');

  try {
    const user = db.prepare(`
      SELECT * FROM users
      WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE
    `).get(cleanLogin, cleanLogin) as any;

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'AUTH_INVALID_CREDENTIALS', message: 'Usuário ou senha incorretos.' });
    }

    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const userAgent = req.headers['user-agent'] || 'Web Browser';
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000;

    db.prepare(`
      INSERT INTO sessions (id, user_id, device_name, platform, browser, ip, created_at, last_active_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, user.id, 'Dispositivo Atual', 'web', userAgent.slice(0, 48), ip, now, now, expiresAt);

    // Update presence
    db.prepare("UPDATE users SET presence = 'ONLINE', updated_at = ? WHERE id = ?").run(now, user.id);

    res.json({
      token: sessionId,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        avatar: user.avatar,
        banner: user.banner,
        bio: user.bio,
        customStatus: user.custom_status,
        presence: user.presence || 'ONLINE',
        role: user.role,
        hasSecurityPin: Boolean(user.security_pin_hash),
        lastDisplayNameChangeAt: user.last_display_name_change_at ? new Date(user.last_display_name_change_at).toISOString() : null,
        createdAt: new Date(user.created_at).toISOString(),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Falha ao autenticar.' });
  }
});

// Current User
app.get('/api/auth/me', authMiddleware, (req: AuthRequest, res) => {
  res.json({ user: req.user, session: { id: req.session.id } });
});

// Logout
app.post('/api/auth/logout', authMiddleware, (req: AuthRequest, res) => {
  try {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.session.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'LOGOUT_ERROR' });
  }
});

// List Sessions
app.get('/api/auth/sessions', authMiddleware, (req: AuthRequest, res) => {
  try {
    const sessions = db.prepare(`
      SELECT id, device_name, platform, browser, ip, created_at, last_active_at
      FROM sessions
      WHERE user_id = ? AND expires_at > ?
      ORDER BY last_active_at DESC
    `).all(req.user.id, Date.now()) as any[];

    const mapped = sessions.map((s) => ({
      id: s.id,
      deviceName: s.device_name,
      platform: s.platform,
      browser: s.browser,
      ip: s.ip,
      createdAt: new Date(s.created_at).toISOString(),
      lastActiveAt: new Date(s.last_active_at).toISOString(),
      isCurrent: s.id === req.session.id,
    }));

    res.json({ sessions: mapped });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Revoke sessions
app.post('/api/auth/sessions/revoke', authMiddleware, (req: AuthRequest, res) => {
  const { targetSessionId, revokeOthers } = req.body;
  try {
    if (revokeOthers) {
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(req.user.id, req.session.id);
      db.prepare('INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)').run(
        crypto.randomUUID(),
        req.user.id,
        'REVOKE_OTHER_SESSIONS',
        'Revogadas todas as outras sessões ativas',
        Date.now()
      );
    } else if (targetSessionId) {
      db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(targetSessionId, req.user.id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'REVOKE_ERROR' });
  }
});

// ======================== PROFILE & SECURITY PIN ========================

// Update Profile (bio, customStatus, presence, avatar)
app.patch('/api/user/profile', authMiddleware, (req: AuthRequest, res) => {
  const { bio, customStatus, presence, avatar, banner } = req.body;
  const now = Date.now();

  try {
    const updates: string[] = [];
    const params: any[] = [];

    if (bio !== undefined) {
      updates.push('bio = ?');
      params.push(String(bio).slice(0, 190));
    }
    if (customStatus !== undefined) {
      updates.push('custom_status = ?');
      params.push(String(customStatus).slice(0, 80));
    }
    if (presence !== undefined) {
      updates.push('presence = ?');
      params.push(presence);
    }
    if (avatar !== undefined) {
      updates.push('avatar = ?');
      params.push(avatar);
    }
    if (banner !== undefined) {
      updates.push('banner = ?');
      params.push(banner);
    }

    if (updates.length === 0) {
      return res.json({ success: true, user: req.user });
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(req.user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Broadcast presence update
    if (presence) {
      const friends = db.prepare(`
        SELECT CASE WHEN user_a_id = ? THEN user_b_id ELSE user_a_id END as friend_id
        FROM friendships
        WHERE (user_a_id = ? OR user_b_id = ?) AND status = 'ACCEPTED'
      `).all(req.user.id, req.user.id, req.user.id) as { friend_id: string }[];

      for (const f of friends) {
        sendToUser(f.friend_id, 'presence:update', {
          userId: req.user.id,
          username: req.user.username,
          presence,
          customStatus: customStatus ?? req.user.customStatus,
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'PROFILE_UPDATE_ERROR' });
  }
});

// Update Display Name (with 7-day cooldown & Security PIN bypass)
app.post('/api/user/display-name', authMiddleware, (req: AuthRequest, res) => {
  const { newDisplayName, securityPin } = req.body;
  if (!newDisplayName || typeof newDisplayName !== 'string' || !newDisplayName.trim()) {
    return res.status(400).json({ error: 'INVALID_NAME', message: 'Nome de exibição inválido.' });
  }

  const cleanName = newDisplayName.trim().slice(0, 32);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  const lastChange = user.last_display_name_change_at || 0;
  const elapsed = now - lastChange;
  const isWithinCooldown = elapsed < SEVEN_DAYS_MS;

  if (isWithinCooldown) {
    // Check if security PIN was provided and is valid
    if (!securityPin) {
      const remainingMs = SEVEN_DAYS_MS - elapsed;
      const hours = Math.floor(remainingMs / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);
      return res.status(403).json({
        error: 'NAME_CHANGE_COOLDOWN',
        message: `Você só pode alterar seu nome a cada 7 dias (${days}d ${hours % 24}h restantes). Use seu Security PIN para alterar agora.`,
        remainingMs,
      });
    }

    if (!user.security_pin_hash || !verifyPin(securityPin, user.security_pin_hash)) {
      return res.status(401).json({ error: 'INVALID_SECURITY_PIN', message: 'Security PIN incorreto.' });
    }

    // Bypass successful! Log to AuditLog
    db.prepare('INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)').run(
      crypto.randomUUID(),
      req.user.id,
      'DISPLAY_NAME_PIN_BYPASS',
      `Alterou nome de "${user.display_name}" para "${cleanName}" utilizando Security PIN`,
      now
    );
  }

  // Update display name
  db.prepare('UPDATE users SET display_name = ?, last_display_name_change_at = ?, updated_at = ? WHERE id = ?').run(
    cleanName,
    now,
    now,
    req.user.id
  );

  res.json({
    success: true,
    displayName: cleanName,
    lastDisplayNameChangeAt: new Date(now).toISOString(),
  });
});

// Configure or change Security PIN
app.post('/api/user/security-pin', authMiddleware, (req: AuthRequest, res) => {
  const { currentPassword, newPin } = req.body;
  if (!newPin || String(newPin).length < 4 || String(newPin).length > 8) {
    return res.status(400).json({ error: 'INVALID_PIN', message: 'O Security PIN deve ter entre 4 e 8 dígitos.' });
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id) as any;
  if (!verifyPassword(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'AUTH_INVALID_PASSWORD', message: 'Senha atual incorreta.' });
  }

  const pinHash = hashPin(String(newPin));
  const now = Date.now();

  db.prepare('UPDATE users SET security_pin_hash = ?, updated_at = ? WHERE id = ?').run(pinHash, now, req.user.id);

  db.prepare('INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)').run(
    crypto.randomUUID(),
    req.user.id,
    'SECURITY_PIN_UPDATED',
    'Security PIN configurado/atualizado com sucesso',
    now
  );

  res.json({ success: true, message: 'Security PIN configurado com sucesso.' });
});

// Audit Logs
app.get('/api/user/audit-logs', authMiddleware, (req: AuthRequest, res) => {
  const logs = db.prepare('SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id) as any[];
  res.json({
    logs: logs.map((l) => ({
      id: l.id,
      userId: l.user_id,
      action: l.action,
      details: l.details,
      createdAt: new Date(l.created_at).toISOString(),
    })),
  });
});

// Server Health & Status Check
app.get('/api/status', (req, res) => {
  try {
    const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0;
    const onlineCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE presence = 'ONLINE' OR presence = 'STREAMING'").get() as any)?.count || 0;
    const friendshipCount = (db.prepare("SELECT COUNT(*) as count FROM friendships WHERE status = 'ACCEPTED'").get() as any)?.count || 0;

    res.json({
      status: 'ONLINE',
      serverTime: Date.now(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: 'HEALTHY',
      registeredUsers: userCount,
      onlineUsers: onlineCount,
      friendships: friendshipCount,
      activeConnections: connectedUsers.size,
      activeRooms: rooms.size,
      version: '1.4.0',
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', error: String(err) });
  }
});

// Search & Discover Users on Server
app.get('/api/users/search', authMiddleware, (req: AuthRequest, res) => {
  const query = String(req.query.q || '').trim().toLowerCase().replace(/^@/, '');
  try {
    let users: any[] = [];
    if (query.length > 0) {
      users = db.prepare(`
        SELECT id, username, display_name, avatar, presence, custom_status, email
        FROM users
        WHERE id != ? AND (username LIKE ? OR display_name LIKE ? OR email LIKE ?)
        LIMIT 25
      `).all(req.user.id, `%${query}%`, `%${query}%`, `%${query}%`) as any[];
    } else {
      // List recent active users for discovery
      users = db.prepare(`
        SELECT id, username, display_name, avatar, presence, custom_status, email
        FROM users
        WHERE id != ?
        ORDER BY updated_at DESC
        LIMIT 20
      `).all(req.user.id) as any[];
    }

    if (users.length === 0) {
      return res.json({ users: [] });
    }

    const userIds = users.map((u) => u.id);
    const placeholders = userIds.map(() => '?').join(',');

    const friendships = db.prepare(`
      SELECT user_a_id, user_b_id, status, action_user_id
      FROM friendships
      WHERE (user_a_id = ? AND user_b_id IN (${placeholders}))
         OR (user_b_id = ? AND user_a_id IN (${placeholders}))
    `).all(req.user.id, ...userIds, req.user.id, ...userIds) as any[];

    const mapped = users.map((u) => {
      const f = friendships.find((fs) =>
        (fs.user_a_id === u.id && fs.user_b_id === req.user.id) ||
        (fs.user_b_id === u.id && fs.user_a_id === req.user.id)
      );
      let relationship: 'NONE' | 'FRIENDS' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'BLOCKED' = 'NONE';
      if (f) {
        if (f.status === 'ACCEPTED') relationship = 'FRIENDS';
        else if (f.status === 'BLOCKED') relationship = 'BLOCKED';
        else if (f.status === 'PENDING') {
          relationship = f.action_user_id === req.user.id ? 'PENDING_SENT' : 'PENDING_RECEIVED';
        }
      }

      return {
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatar: u.avatar,
        presence: u.presence,
        customStatus: u.custom_status,
        relationship,
      };
    });

    res.json({ users: mapped });
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ======================== FRIEND SYSTEM ========================

// List Friends
app.get('/api/friends', authMiddleware, (req: AuthRequest, res) => {
  try {
    const rows = db.prepare(`
      SELECT f.id as friendship_id, f.status, f.action_user_id, f.updated_at,
             u.id as user_id, u.username, u.display_name, u.avatar, u.presence, u.custom_status
      FROM friendships f
      JOIN users u ON (u.id = CASE WHEN f.user_a_id = ? THEN f.user_b_id ELSE f.user_a_id END)
      WHERE f.user_a_id = ? OR f.user_b_id = ?
    `).all(req.user.id, req.user.id, req.user.id) as any[];

    const friends = rows.map((r) => ({
      id: r.friendship_id,
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      avatar: r.avatar,
      presence: r.presence,
      customStatus: r.custom_status,
      status: r.status,
      isIncoming: r.status === 'PENDING' && r.action_user_id !== req.user.id,
      updatedAt: new Date(r.updated_at).toISOString(),
    }));

    res.json({ friends });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Send Friend Request (supports username or email, auto-accepts mutual requests)
app.post('/api/friends/request', authMiddleware, (req: AuthRequest, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'USERNAME_REQUIRED', message: 'Informe o @username ou e-mail do seu amigo.' });
  }

  const cleanInput = String(username).trim().toLowerCase().replace(/^@/, '');
  if (cleanInput === req.user.username.toLowerCase() || cleanInput === req.user.email?.toLowerCase()) {
    return res.status(400).json({ error: 'SELF_REQUEST', message: 'Você não pode adicionar a si mesmo.' });
  }

  try {
    // Find target user by username OR email
    const targetUser = db.prepare(`
      SELECT id, username, display_name, avatar, email
      FROM users
      WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE
    `).get(cleanInput, cleanInput) as any;

    if (!targetUser) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: `Usuário "${cleanInput}" não foi encontrado. Verifique a grafia ou convide seu amigo a criar uma conta no LUNE!`,
      });
    }

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'SELF_REQUEST', message: 'Você não pode adicionar a si mesmo.' });
    }

    // Check existing friendship
    const [userA, userB] = req.user.id < targetUser.id ? [req.user.id, targetUser.id] : [targetUser.id, req.user.id];
    const existing = db.prepare('SELECT * FROM friendships WHERE user_a_id = ? AND user_b_id = ?').get(userA, userB) as any;
    const now = Date.now();

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return res.status(400).json({ error: 'ALREADY_FRIENDS', message: `Você e @${targetUser.username} já são amigos!` });
      }
      if (existing.status === 'BLOCKED') {
        return res.status(400).json({ error: 'BLOCKED', message: 'Não é possível enviar pedido para este usuário.' });
      }
      if (existing.status === 'PENDING') {
        // If the other user already sent a pending request to ME: Mutual request -> AUTO-ACCEPT!
        if (existing.action_user_id !== req.user.id) {
          db.prepare("UPDATE friendships SET status = 'ACCEPTED', action_user_id = ?, updated_at = ? WHERE id = ?").run(req.user.id, now, existing.id);

          // Create or ensure DM conversation exists
          let conv = db.prepare(`
            SELECT c.id FROM conversations c
            JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
            JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
            WHERE c.type = 'DM'
          `).get(req.user.id, targetUser.id) as { id: string } | undefined;

          if (!conv) {
            const convId = crypto.randomUUID();
            db.prepare("INSERT INTO conversations (id, type, created_at, updated_at) VALUES (?, 'DM', ?, ?)").run(convId, now, now);
            db.prepare("INSERT INTO conversation_members (conversation_id, user_id, role, joined_at, last_read_at) VALUES (?, ?, 'MEMBER', ?, ?), (?, ?, 'MEMBER', ?, ?)").run(convId, req.user.id, now, now, convId, targetUser.id, now, now);
          }

          sendToUser(targetUser.id, 'friend:accepted', { byUser: req.user });
          return res.json({
            success: true,
            autoAccepted: true,
            message: `Vocês se adicionaram mutuamente! Agora você e @${targetUser.username} são amigos!`,
          });
        } else {
          return res.status(400).json({
            error: 'PENDING_EXISTS',
            message: `Pedido de amizade já enviado para @${targetUser.username}. Aguardando seu amigo aceitar na aba "Pendentes".`,
          });
        }
      }
    }

    const friendshipId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO friendships (id, user_a_id, user_b_id, status, action_user_id, created_at, updated_at)
      VALUES (?, ?, ?, 'PENDING', ?, ?, ?)
      ON CONFLICT(user_a_id, user_b_id) DO UPDATE SET status = 'PENDING', action_user_id = ?, updated_at = ?
    `).run(friendshipId, userA, userB, req.user.id, now, now, req.user.id, now);

    // Notify target user in real time
    sendToUser(targetUser.id, 'friend:request', {
      fromUser: {
        id: req.user.id,
        username: req.user.username,
        displayName: req.user.displayName,
        avatar: req.user.avatar,
      },
    });

    res.json({ success: true, message: `Pedido de amizade enviado com sucesso para @${targetUser.username}!` });
  } catch (err) {
    console.error('Friend request error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Erro no servidor ao enviar pedido de amizade.' });
  }
});

// Respond to friend request
app.post('/api/friends/respond', authMiddleware, (req: AuthRequest, res) => {
  const { friendshipId, action } = req.body; // 'ACCEPT' | 'DECLINE' | 'BLOCK' | 'REMOVE'
  if (!friendshipId || !action) {
    return res.status(400).json({ error: 'INVALID_REQUEST' });
  }

  try {
    const friendship = db.prepare('SELECT * FROM friendships WHERE id = ?').get(friendshipId) as any;
    if (!friendship) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Solicitação não encontrada.' });
    }

    const now = Date.now();
    const otherUserId = friendship.user_a_id === req.user.id ? friendship.user_b_id : friendship.user_a_id;

    if (action === 'ACCEPT') {
      db.prepare("UPDATE friendships SET status = 'ACCEPTED', action_user_id = ?, updated_at = ? WHERE id = ?").run(req.user.id, now, friendshipId);

      // Create or ensure DM conversation exists
      let conv = db.prepare(`
        SELECT c.id FROM conversations c
        JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
        JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
        WHERE c.type = 'DM'
      `).get(req.user.id, otherUserId) as { id: string } | undefined;

      if (!conv) {
        const convId = crypto.randomUUID();
        db.prepare("INSERT INTO conversations (id, type, created_at, updated_at) VALUES (?, 'DM', ?, ?)").run(convId, now, now);
        db.prepare("INSERT INTO conversation_members (conversation_id, user_id, role, joined_at, last_read_at) VALUES (?, ?, 'MEMBER', ?, ?), (?, ?, 'MEMBER', ?, ?)").run(convId, req.user.id, now, now, convId, otherUserId, now, now);
      }

      sendToUser(otherUserId, 'friend:accepted', { byUser: req.user });
    } else if (action === 'DECLINE' || action === 'REMOVE') {
      db.prepare('DELETE FROM friendships WHERE id = ?').run(friendshipId);
    } else if (action === 'BLOCK') {
      db.prepare("UPDATE friendships SET status = 'BLOCKED', action_user_id = ?, updated_at = ? WHERE id = ?").run(req.user.id, now, friendshipId);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Friend respond error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ======================== CONVERSATIONS & MESSAGING ========================

// List conversations
app.get('/api/conversations', authMiddleware, (req: AuthRequest, res) => {
  try {
    const convs = db.prepare(`
      SELECT c.id, c.type, c.name, c.icon, c.owner_id, c.updated_at
      FROM conversations c
      JOIN conversation_members cm ON c.id = cm.conversation_id
      WHERE cm.user_id = ?
      ORDER BY c.updated_at DESC
    `).all(req.user.id) as any[];

    const result = convs.map((c) => {
      // Get members
      const members = db.prepare(`
        SELECT u.id as user_id, u.username, u.display_name, u.avatar, u.presence, cm.role
        FROM conversation_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.conversation_id = ?
      `).all(c.id) as any[];

      // Get last message
      const lastMsg = db.prepare(`
        SELECT m.id, m.content, m.created_at, u.username as author_name
        FROM messages m
        JOIN users u ON m.author_id = u.id
        WHERE m.conversation_id = ?
        ORDER BY m.created_at DESC LIMIT 1
      `).get(c.id) as any;

      return {
        id: c.id,
        type: c.type,
        name: c.name,
        icon: c.icon,
        ownerId: c.owner_id,
        members: members.map((m) => ({
          userId: m.user_id,
          username: m.username,
          displayName: m.display_name,
          avatar: m.avatar,
          presence: m.presence,
          role: m.role,
        })),
        lastMessage: lastMsg ? {
          id: lastMsg.id,
          content: lastMsg.content,
          authorName: lastMsg.author_name,
          createdAt: new Date(lastMsg.created_at).toISOString(),
        } : undefined,
        unreadCount: 0,
        updatedAt: new Date(c.updated_at).toISOString(),
      };
    });

    res.json({ conversations: result });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Create or open DM
app.post('/api/conversations/dm', authMiddleware, (req: AuthRequest, res) => {
  const { targetUserId } = req.body;
  if (!targetUserId) return res.status(400).json({ error: 'TARGET_REQUIRED' });

  try {
    // Check if DM already exists between these 2 users
    const existing = db.prepare(`
      SELECT c.id
      FROM conversations c
      JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
      JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
      WHERE c.type = 'DM'
    `).get(req.user.id, targetUserId) as { id: string } | undefined;

    if (existing) {
      return res.json({ conversationId: existing.id });
    }

    // Create new DM
    const convId = crypto.randomUUID();
    const now = Date.now();
    db.prepare("INSERT INTO conversations (id, type, created_at, updated_at) VALUES (?, 'DM', ?, ?)").run(convId, now, now);
    db.prepare("INSERT INTO conversation_members (conversation_id, user_id, role, joined_at, last_read_at) VALUES (?, ?, 'MEMBER', ?, ?), (?, ?, 'MEMBER', ?, ?)").run(convId, req.user.id, now, now, convId, targetUserId, now, now);

    res.json({ conversationId: convId });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Create Group
app.post('/api/conversations/group', authMiddleware, (req: AuthRequest, res) => {
  const { name, icon, memberUsernames } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'NAME_REQUIRED' });

  try {
    const convId = crypto.randomUUID();
    const now = Date.now();
    db.prepare("INSERT INTO conversations (id, type, name, icon, owner_id, created_at, updated_at) VALUES (?, 'GROUP', ?, ?, ?, ?, ?)").run(
      convId,
      name.trim().slice(0, 48),
      icon || '/logo.svg',
      req.user.id,
      now,
      now
    );

    db.prepare("INSERT INTO conversation_members (conversation_id, user_id, role, joined_at, last_read_at) VALUES (?, ?, 'OWNER', ?, ?)").run(convId, req.user.id, now, now);

    if (Array.isArray(memberUsernames)) {
      for (const u of memberUsernames) {
        const target = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(String(u).trim().replace(/^@/, '')) as { id: string } | undefined;
        if (target && target.id !== req.user.id) {
          db.prepare("INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, role, joined_at, last_read_at) VALUES (?, ?, 'MEMBER', ?, ?)").run(convId, target.id, now, now);
        }
      }
    }

    res.json({ conversationId: convId });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Get Messages (Cursor-based pagination)
app.get('/api/conversations/:id/messages', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { cursor, limit = 50 } = req.query;

  try {
    let query = `
      SELECT m.*, u.username, u.display_name, u.avatar, u.presence
      FROM messages m
      JOIN users u ON m.author_id = u.id
      WHERE m.conversation_id = ?
    `;
    const params: any[] = [id];

    if (cursor) {
      query += ' AND m.created_at < ? ';
      params.push(Number(cursor));
    }

    query += ' ORDER BY m.created_at DESC LIMIT ? ';
    params.push(Math.min(100, Number(limit)));

    const rows = db.prepare(query).all(...params) as any[];

    // Fetch reactions and reply info for these messages
    const messages = rows.reverse().map((r) => {
      const reactions = db.prepare(`
        SELECT emoji, COUNT(*) as count, GROUP_CONCAT(u.username) as users
        FROM message_reactions mr
        JOIN users u ON mr.user_id = u.id
        WHERE mr.message_id = ?
        GROUP BY emoji
      `).all(r.id) as any[];

      const attachments = db.prepare('SELECT * FROM message_attachments WHERE message_id = ?').all(r.id) as any[];

      return {
        id: r.id,
        conversationId: r.conversation_id,
        authorId: r.author_id,
        author: {
          id: r.author_id,
          username: r.username,
          displayName: r.display_name,
          avatar: r.avatar,
          presence: r.presence,
        },
        content: r.content,
        replyTo: r.reply_to_id ? { id: r.reply_to_id } : undefined,
        isPinned: Boolean(r.is_pinned),
        reactions: reactions.map((rx) => ({
          id: rx.emoji,
          emoji: rx.emoji,
          count: rx.count,
          users: rx.users ? rx.users.split(',') : [],
        })),
        attachments: attachments.map((a) => ({
          id: a.id,
          url: a.url,
          filename: a.filename,
          size: a.size,
          mimeType: a.mime_type,
        })),
        createdAt: new Date(r.created_at).toISOString(),
        editedAt: r.edited_at ? new Date(r.edited_at).toISOString() : undefined,
      };
    });

    res.json({ messages });
  } catch (err) {
    console.error('Error loading messages:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Send Message
app.post('/api/conversations/:id/messages', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { content, replyToId, attachments } = req.body;

  if ((!content || !content.trim()) && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ error: 'EMPTY_MESSAGE' });
  }

  try {
    const msgId = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO messages (id, conversation_id, author_id, content, reply_to_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(msgId, id, req.user.id, String(content || '').trim(), replyToId || null, now);

    // Update conversation updated_at
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, id);

    // Save attachments if any
    if (Array.isArray(attachments)) {
      for (const att of attachments) {
        db.prepare('INSERT INTO message_attachments (id, message_id, url, filename, size, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          crypto.randomUUID(),
          msgId,
          att.url,
          att.filename || 'attachment',
          att.size || 0,
          att.mimeType || 'application/octet-stream',
          now
        );
      }
    }

    const fullMessage = {
      id: msgId,
      conversationId: id,
      authorId: req.user.id,
      author: {
        id: req.user.id,
        username: req.user.username,
        displayName: req.user.displayName,
        avatar: req.user.avatar,
        presence: req.user.presence,
      },
      content: String(content || '').trim(),
      replyTo: replyToId ? { id: replyToId } : undefined,
      reactions: [],
      attachments: attachments || [],
      isPinned: false,
      createdAt: new Date(now).toISOString(),
    };

    // Broadcast realtime to conversation members
    broadcastToConversation(id, 'message:new', { message: fullMessage });

    res.json({ message: fullMessage });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// React to message
app.post('/api/messages/:id/reactions', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'EMOJI_REQUIRED' });

  try {
    const existing = db.prepare('SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').get(id, req.user.id, emoji);
    if (existing) {
      db.prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(id, req.user.id, emoji);
    } else {
      db.prepare('INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)').run(
        crypto.randomUUID(),
        id,
        req.user.id,
        emoji,
        Date.now()
      );
    }

    const msg = db.prepare('SELECT conversation_id FROM messages WHERE id = ?').get(id) as { conversation_id: string } | undefined;
    if (msg) {
      broadcastToConversation(msg.conversation_id, 'message:reaction', { messageId: id, emoji, userId: req.user.id });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Pin/Unpin message
app.post('/api/messages/:id/pin', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const msg = db.prepare('SELECT is_pinned, conversation_id FROM messages WHERE id = ?').get(id) as any;
    if (!msg) return res.status(404).json({ error: 'NOT_FOUND' });

    const newPinned = msg.is_pinned ? 0 : 1;
    db.prepare('UPDATE messages SET is_pinned = ? WHERE id = ?').run(newPinned, id);

    broadcastToConversation(msg.conversation_id, 'message:pin', { messageId: id, isPinned: Boolean(newPinned) });

    res.json({ success: true, isPinned: Boolean(newPinned) });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Delete message
app.delete('/api/messages/:id', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const msg = db.prepare('SELECT author_id, conversation_id FROM messages WHERE id = ?').get(id) as any;
    if (!msg) return res.status(404).json({ error: 'NOT_FOUND' });

    if (msg.author_id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    broadcastToConversation(msg.conversation_id, 'message:delete', { messageId: id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Upload attachment
app.post('/api/upload', authMiddleware, (req: AuthRequest, res) => {
  const { dataUrl, filename, mimeType, size } = req.body;
  if (!dataUrl) return res.status(400).json({ error: 'NO_DATA' });

  // In this container environment, we securely serve the uploaded dataUrl or public asset url
  res.json({
    url: dataUrl,
    filename: filename || 'upload',
    mimeType: mimeType || 'image/png',
    size: size || 0,
  });
});

// ======================== WEBSOCKET REALTIME ENGINE ========================

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (rawData) => {
    try {
      const data = JSON.parse(rawData.toString());
      const { type, payload } = data;

      switch (type) {
        // Authenticate socket connection
        case 'auth': {
          const { token } = payload || {};
          if (!token) return;

          const session = db.prepare(`
            SELECT s.id, u.id as user_id, u.username
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = ? AND s.expires_at > ?
          `).get(token, Date.now()) as any;

          if (session) {
            socketToUser.set(ws, { userId: session.user_id, username: session.username, sessionId: session.id });
            if (!connectedUsers.has(session.user_id)) {
              connectedUsers.set(session.user_id, new Set());
            }
            connectedUsers.get(session.user_id)!.add(ws);

            ws.send(JSON.stringify({
              type: 'auth:success',
              payload: { userId: session.user_id, username: session.username },
            }));
          }
          break;
        }

        // Typing indicators
        case 'typing:start': {
          const client = socketToUser.get(ws);
          if (client && payload?.conversationId) {
            broadcastToConversation(payload.conversationId, 'typing:start', {
              conversationId: payload.conversationId,
              userId: client.userId,
              username: client.username,
            }, client.userId);
          }
          break;
        }

        case 'typing:stop': {
          const client = socketToUser.get(ws);
          if (client && payload?.conversationId) {
            broadcastToConversation(payload.conversationId, 'typing:stop', {
              conversationId: payload.conversationId,
              userId: client.userId,
            }, client.userId);
          }
          break;
        }

        // WebRTC Signaling for 1-to-1 Calls & Screen Sharing
        case 'call:initiate': {
          const client = socketToUser.get(ws);
          const targetUserId = payload?.targetUserId;
          if (targetUserId) {
            const senderUser = {
              id: client?.userId || payload?.fromUser?.id || 'unknown',
              name: client?.username || payload?.fromUser?.name || 'Amigo',
              username: client?.username || payload?.fromUser?.username || 'amigo',
              tag: `@${client?.username || payload?.fromUser?.username || 'amigo'}`,
              avatarColor: '#d1d5db',
            };
            const callRoomId = payload?.roomId || `lune_call_${[senderUser.id, targetUserId].sort().join('_').slice(0, 16)}`;

            sendToUser(targetUserId, 'call:incoming', {
              callId: payload?.callId || crypto.randomUUID(),
              fromUser: senderUser,
              roomId: callRoomId,
              type: payload?.type || 'voice',
              timestamp: Date.now(),
            });

            // Also send alias 'incoming-call' for backwards compatibility
            sendToUser(targetUserId, 'incoming-call', {
              callId: payload?.callId || crypto.randomUUID(),
              fromUser: senderUser,
              roomId: callRoomId,
              type: payload?.type || 'voice',
              timestamp: Date.now(),
            });
          }
          break;
        }

        case 'call:accept': {
          const client = socketToUser.get(ws);
          if (client && payload?.targetUserId) {
            sendToUser(payload.targetUserId, 'call:accepted', {
              callId: payload.callId,
              byUser: { id: client.userId, username: client.username },
            });
          }
          break;
        }

        case 'call:decline': {
          const client = socketToUser.get(ws);
          if (client && payload?.targetUserId) {
            sendToUser(payload.targetUserId, 'call:declined', {
              callId: payload.callId,
            });
          }
          break;
        }

        case 'call:end': {
          const client = socketToUser.get(ws);
          if (client && payload?.targetUserId) {
            sendToUser(payload.targetUserId, 'call:ended', {
              callId: payload.callId,
            });
          }
          break;
        }

        // WebRTC Multi-user Rooms & Screen Share
        case 'join-room': {
          const { roomId, user } = payload || {};
          if (!roomId || !user) break;

          const client = socketToUser.get(ws);
          const participantUser = {
            id: user.id || client?.userId || crypto.randomUUID(),
            name: user.name || client?.username || 'Participante',
            tag: user.tag || `@${client?.username || 'user'}`,
            avatarColor: user.avatarColor || '#d1d5db',
          };

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
          }
          const roomMap = rooms.get(roomId)!;

          // Gather existing participants to return to joiner
          const existingParticipants: any[] = [];
          for (const [pId, pData] of roomMap.entries()) {
            if (pId !== participantUser.id) {
              existingParticipants.push(pData.user);
            }
          }

          // Register in room
          roomMap.set(participantUser.id, { ws, user: participantUser });

          if (!socketRooms.has(ws)) {
            socketRooms.set(ws, new Set());
          }
          socketRooms.get(ws)!.add(roomId);

          // Confirm join to the calling client
          ws.send(JSON.stringify({
            type: 'joined-room-success',
            payload: {
              roomId,
              participants: existingParticipants,
            },
          }));

          // Notify existing participants in the room
          for (const [pId, pData] of roomMap.entries()) {
            if (pId !== participantUser.id && pData.ws.readyState === WebSocket.OPEN) {
              pData.ws.send(JSON.stringify({
                type: 'user-joined',
                payload: { user: participantUser },
              }));
            }
          }
          break;
        }

        case 'leave-room': {
          const clientRooms = socketRooms.get(ws);
          if (clientRooms) {
            for (const rId of clientRooms) {
              const rMap = rooms.get(rId);
              if (rMap) {
                let leftUser: any = null;
                for (const [uId, pData] of rMap.entries()) {
                  if (pData.ws === ws) {
                    leftUser = pData.user;
                    rMap.delete(uId);
                    break;
                  }
                }
                if (leftUser) {
                  for (const pData of rMap.values()) {
                    if (pData.ws.readyState === WebSocket.OPEN) {
                      pData.ws.send(JSON.stringify({
                        type: 'user-left',
                        payload: { userId: leftUser.id, user: leftUser },
                      }));
                    }
                  }
                }
                if (rMap.size === 0) {
                  rooms.delete(rId);
                }
              }
            }
            clientRooms.clear();
          }
          break;
        }

        // WebRTC Signaling (Offers, Answers, ICE Candidates)
        case 'signal':
        case 'webrtc:signal': {
          const { toUserId, roomId, signalData, signal } = payload || {};
          const client = socketToUser.get(ws);
          const fromUser = payload?.fromUser || (client ? {
            id: client.userId,
            name: client.username,
            tag: `@${client.username}`,
            avatarColor: '#d1d5db',
          } : null);

          const actualSignal = signalData || signal;
          if (toUserId && actualSignal) {
            sendToUser(toUserId, 'signal', {
              fromUser: fromUser || { id: client?.userId || 'peer' },
              fromUserId: client?.userId || payload?.fromUser?.id,
              signalData: actualSignal,
              signal: actualSignal,
              roomId,
            });
          }
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
        }
      }
    } catch (err) {
      console.error('WS Error:', err);
    }
  });

  ws.on('close', () => {
    // Cleanup WebRTC rooms
    const clientRooms = socketRooms.get(ws);
    if (clientRooms) {
      for (const rId of clientRooms) {
        const rMap = rooms.get(rId);
        if (rMap) {
          let leftUser: any = null;
          for (const [uId, pData] of rMap.entries()) {
            if (pData.ws === ws) {
              leftUser = pData.user;
              rMap.delete(uId);
              break;
            }
          }
          if (leftUser) {
            for (const pData of rMap.values()) {
              if (pData.ws.readyState === WebSocket.OPEN) {
                pData.ws.send(JSON.stringify({
                  type: 'user-left',
                  payload: { userId: leftUser.id, user: leftUser },
                }));
              }
            }
          }
          if (rMap.size === 0) {
            rooms.delete(rId);
          }
        }
      }
      socketRooms.delete(ws);
    }

    const client = socketToUser.get(ws);
    if (client) {
      const userSockets = connectedUsers.get(client.userId);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          connectedUsers.delete(client.userId);
        }
      }
      socketToUser.delete(ws);
    }
  });
});

// Setup Vite or Static File Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[LUNE Full-Stack Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
