import { query } from '../db/index.js';
import bcrypt from 'bcrypt';

// ===== USERS REPOSITORY =====

export async function createUser(email, password) {
  const hashedPassword = await bcrypt.hash(password, 12);
  const result = await query(
    'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at',
    [email, hashedPassword]
  );
  return result.rows[0];
}

export async function findUserByEmail(email) {
  const result = await query(
    'SELECT id, email, password, created_at FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];
}

export async function findUserById(id) {
  const result = await query(
    'SELECT id, email, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
}

export async function validatePassword(user, password) {
  return bcrypt.compare(password, user.password);
}

// ===== TODOS REPOSITORY =====

export async function createTodo(userId, title) {
  const result = await query(
    'INSERT INTO todos (user_id, title) VALUES ($1, $2) RETURNING id, user_id, title, completed, created_at',
    [userId, title]
  );
  return result.rows[0];
}

export async function getTodosByUserId(userId) {
  const result = await query(
    'SELECT id, user_id, title, completed, created_at, updated_at FROM todos WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

export async function updateTodo(todoId, userId, title, completed) {
  const result = await query(
    'UPDATE todos SET title = $1, completed = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING id, user_id, title, completed, updated_at',
    [title, completed, todoId, userId]
  );
  return result.rows[0];
}

export async function deleteTodo(todoId, userId) {
  const result = await query(
    'DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING id',
    [todoId, userId]
  );
  return result.rows[0];
}

// ===== REFRESH TOKENS REPOSITORY (OPAQUE) =====

// Guardar refresh token (hash + jti + ip)
export async function saveRefreshToken(userId, token, jti, expiresAt, ip = null) {
  // Hashear el token con SHA-256
  const crypto = await import('crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const result = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, jti, expires_at, ip, revoked)
     VALUES ($1, $2, $3, $4, $5, false) RETURNING id`,
    [userId, tokenHash, jti, expiresAt, ip]
  );
  return result.rows[0];
}

// Buscar por hash del token (lookup opaco)
export async function findRefreshTokenByHash(tokenHash) {
  const result = await query(
    `SELECT rt.id, rt.user_id, rt.token_hash, rt.jti, rt.expires_at, rt.ip, rt.revoked, u.email
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  );
  return result.rows[0];
}

// Revocar un token específico - solo una transacción gana (previene race condition)
export async function revokeRefreshToken(tokenId) {
  const result = await query(
    `UPDATE refresh_tokens
     SET revoked = true, last_used_at = NOW()
     WHERE id = $1 AND revoked = false
     RETURNING *`,
    [tokenId]
  );
  return result.rows[0];  // Si null → ya fue revocado (race condition detectada)
}

// Eliminar token por hash (legacy - mantener compatibilidad)
export async function deleteRefreshToken(token) {
  const crypto = await import('crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
}

// Eliminar todos los tokens del usuario
export async function deleteAllUserRefreshTokens(userId) {
  await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
}

// Obtener sesiones activas del usuario (para endpoint /me/sessions)
export async function getUserSessions(userId) {
  const result = await query(
    `SELECT id, jti, ip, created_at, expires_at
     FROM refresh_tokens
     WHERE user_id = $1 AND revoked = false AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

// Limpiar tokens vencidos
export async function cleanupExpiredTokens() {
  await query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
}

// cleanup de tokens revokeados (más de 24 horas)
export async function cleanupRevokedTokens() {
  await query(
    `DELETE FROM refresh_tokens
     WHERE revoked = true AND expires_at < NOW() - INTERVAL '24 hours'`
  );
}

// ===== API /me/sessions =====

// Buscar sesión por ID (para verificar ownership)
export async function findSessionById(sessionId) {
  const result = await query(
    `SELECT id, user_id, jti, ip, created_at, last_used_at, revoked
     FROM refresh_tokens
     WHERE id = $1`,
    [sessionId]
  );
  return result.rows[0];
}

// Contar sesiones activas del usuario
export async function countActiveSessions(userId) {
  const result = await query(
    `SELECT COUNT(*) as count
     FROM refresh_tokens
     WHERE user_id = $1 AND revoked = false AND expires_at > NOW()`,
    [userId]
  );
  return parseInt(result.rows[0].count);
}

// Eliminar sesiones más antiguas si excede el límite
export async function enforceSessionLimit(userId, maxSessions) {
  await query(
    `DELETE FROM refresh_tokens
     WHERE id IN (
       SELECT id FROM refresh_tokens
       WHERE user_id = $1 AND revoked = false
       ORDER BY created_at DESC
       OFFSET $2
     )`,
    [userId, maxSessions]
  );
}