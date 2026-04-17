import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { jwtConfig, cookieConfig } from '../config/index.js';
import * as userRepo from '../models/user.repository.js';

// Generador de refresh token opaco (NO JWT)
// 64 bytes = 128 hex chars = 256 bits de entropía
function generateOpaqueRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

// Hash del token para guardar en DB (HMAC-SHA256 con server secret)
// Si la DB se filtra, los hashes son inútiles sin el secret
function hashToken(token) {
  const serverSecret = process.env.TOKEN_HASH_SECRET || jwtConfig.refreshSecret;
  return crypto.createHmac('sha256', serverSecret).update(token).digest('hex');
}

// ===== ACCESS TOKEN =====

export function generateAccessToken(user) {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      type: 'access'  // Tipo explícito para distinguir
    },
    jwtConfig.accessSecret,
    { expiresIn: jwtConfig.accessExpiresIn }
  );
}

export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, jwtConfig.accessSecret);
    
    // Validar que es un access token
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
}

// ===== REFRESH TOKEN (OPAQUE - NO JWT) =====

// Generate opaque refresh token (random bytes, NO JWT)
export function generateRefreshToken(user, metadata = {}) {
  const opaqueToken = generateOpaqueRefreshToken();
  const tokenHash = hashToken(opaqueToken);

  return {
    token: opaqueToken,
    hash: tokenHash,
    jti: crypto.randomUUID(),  // token ID único para identificación
    userId: user.id,
    userAgent: metadata?.userAgent,
    createdAt: new Date()
  };
}


    // No bloqueamos por UserAgent, solo logueamos
  }

  return true;
}

// ===== CSRF TOKEN =====

export function generateCsrfToken(userId) {
  return jwt.sign(
    { userId, type: 'csrf' },
    jwtConfig.accessSecret,
    { expiresIn: jwtConfig.csrfExpiresIn }
  );
}

export function verifyCsrfToken(token, userId) {
  try {
    const decoded = jwt.verify(token, jwtConfig.accessSecret);
    
    if (decoded.type !== 'csrf' || decoded.userId !== userId) {
      throw new Error('Invalid CSRF token');
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

// ===== COOKIE HELPERS =====

export function setRefreshTokenCookie(res, token) {
  res.cookie(
    cookieConfig.refreshToken.name,
    token,
    {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/auth/refresh',  // Scoped to refresh endpoint
      maxAge: cookieConfig.refreshToken.maxAge
    }
  );
}

export function clearRefreshTokenCookie(res) {
  // IMPORTANTE: clearCookie necesita los mismos flags que setCookie
  res.clearCookie(cookieConfig.refreshToken.name, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/auth/refresh'  // Mismo scope exacto
  });
}
  );
}

export function setCsrfTokenCookie(res, token) {
  res.cookie(
    cookieConfig.csrfToken.name,
    token,
    {
      httpOnly: cookieConfig.csrfToken.httpOnly,
      secure: cookieConfig.csrfToken.secure,
      sameSite: cookieConfig.csrfToken.sameSite,
      path: cookieConfig.csrfToken.path,
      maxAge: cookieConfig.csrfToken.maxAge
    }
  );
}

// ===== AUTH SERVICE =====

export async function login(email, password, metadata = {}) {
  // Buscar usuario
  const user = await userRepo.findUserByEmail(email);

  if (!user) {
    throw new Error('Credenciales inválidas');
  }

  // Validar contraseña
  const validPassword = await userRepo.validatePassword(user, password);

  if (!validPassword) {
    throw new Error('Credenciales inválidas');
  }

  // Generar tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user, metadata);

  // Calcular expiración del refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Guardar refresh token en BD (hash + jti + ip)
  await userRepo.saveRefreshToken(
    user.id,
    refreshToken.token,
    refreshToken.jti,
    expiresAt,
    metadata?.ip
  );

  // Enforce límite de sesiones (max 5)
  const activeSessions = await userRepo.countActiveSessions(user.id);
  if (activeSessions > jwtConfig.maxSessionsPerUser) {
    await userRepo.enforceSessionLimit(user.id, jwtConfig.maxSessionsPerUser);
  }

  // Generar CSRF token
  const csrfToken = generateCsrfToken(user.id);

  return {
    user: { id: user.id, email: user.email },
    accessToken,
    refreshToken: refreshToken.token,
    csrfToken,
    expiresAt
  };
}

export async function refresh(refreshTokenFromCookie, metadata = {}) {
  // 1. Hash del token recibido (opaco - NO JWT)
  const tokenHash = hashToken(refreshTokenFromCookie);

  // 2. Lookup en DB por hash
  const storedToken = await userRepo.findRefreshTokenByHash(tokenHash);

  if (!storedToken) {
    // 🚨 Token no existe o fue revocado → posible reuse attack
    // NO podemos saber el userId porque el token no está en BD
    console.error('🚨 Token reuse/invalid detected');
    throw new Error('Token inválido o expirado');
  }

  // 3. Verificar si ya fue marcado como revocado (reuse detectado)
  if (storedToken.revoked) {
    console.error('🚨 Token reuse detected - invalidating all sessions for user:', storedToken.user_id);
    // Invalidar TODAS las sesiones del usuario
    await userRepo.deleteAllUserRefreshTokens(storedToken.user_id);
    throw new Error('Token revocado. Sesiones invalidadas por seguridad.');
  }

  // 4. Verificar expiración
  if (new Date(storedToken.expires_at) < new Date()) {
    throw new Error('Token expirado');
  }

  // 5. Obtener usuario
  const user = await userRepo.findUserById(storedToken.user_id);

  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  // 6. ⚠️ Soft IP check (solo logging, no invalidar)
  const storedIP = storedToken.ip;
  const currentIP = metadata?.ip;
  if (storedIP && currentIP && storedIP !== currentIP) {
    console.warn('⚠️ IP changed for user:', user.id, { stored: storedIP, current: currentIP });
    // Solo logs, no invalidamos por IP (falsos positivos)
  }

  // 7. 🔄 ROTACIÓN: marcar antiguo como revocado
  await userRepo.revokeRefreshToken(storedToken.id);

  // 8. Generar nuevo access token
  const accessToken = generateAccessToken(user);

  // 9. Generar nuevo refresh token opaco
  const newRefreshToken = generateRefreshToken(user, metadata);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // 10. Guardar nuevo token en BD
  await userRepo.saveRefreshToken(user.id, newRefreshToken.token, newRefreshToken.jti, expiresAt, currentIP);

  // 11. Generar nuevo CSRF token
  const csrfToken = generateCsrfToken(user.id);

  return {
    user: { id: user.id, email: user.email },
    accessToken,
    refreshToken: newRefreshToken.token,
    csrfToken
  };
}

export async function logout(userId, refreshTokenFromCookie) {
  // Eliminar refresh token de BD
  if (refreshTokenFromCookie) {
    await userRepo.deleteRefreshToken(refreshTokenFromCookie);
  }
  
  // Eliminar todos los refresh tokens del usuario (logout desde otro dispositivo)
  await userRepo.deleteAllUserRefreshTokens(userId);
}