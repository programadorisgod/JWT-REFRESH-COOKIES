import express from 'express';
import rateLimit from 'express-rate-limit';
import * as authService from '../services/auth.service.js';
import { setRefreshTokenCookie, clearRefreshTokenCookie, setCsrfTokenCookie, clearCsrfTokenCookie } from '../services/auth.service.js';
import { hashToken as hashTokenHelper } from '../services/auth.service.js';
import { csrfProtection } from '../middleware/csrf.middleware.js';
import * as userRepo from '../models/user.repository.js';

const router = express.Router();

// Rate limit para refresh (prevenir abuse) - 10 por minuto por IP
const refreshLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
  message: { error: 'Demasiadas solicitudes de refresh', code: 'RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false
});

// ===== POST /login =====
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y password requeridos',
        code: 'VALIDATION_ERROR'
      });
    }

    const result = await authService.login(email, password, { ip, userAgent });
    
    setRefreshTokenCookie(res, result.refreshToken);
    setCsrfTokenCookie(res, result.csrfToken);
    
    res.json({
      user: result.user,
      accessToken: result.accessToken
    });
  } catch (error) {
    res.status(401).json({
      error: error.message,
      code: 'AUTH_ERROR'
    });
  }
});

// ===== POST /refresh =====
router.post('/refresh', refreshLimiter, csrfProtection, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!refreshToken) {
      return res.status(401).json({
        error: 'No autorizado',
        code: 'NO_REFRESH_TOKEN'
      });
    }

    const result = await authService.refresh(refreshToken, { ip, userAgent });

    // 🔄 Establecer NUEVO refresh token (rotación)
    setRefreshTokenCookie(res, result.refreshToken);
    setCsrfTokenCookie(res, result.csrfToken);

    res.json({
      user: result.user,
      accessToken: result.accessToken
    });
  } catch (error) {
    clearRefreshTokenCookie(res);
    res.status(401).json({
      error: error.message,
      code: 'REFRESH_ERROR'
    });
  }
});

// ===== POST /logout =====
router.post('/logout', csrfProtection, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      // Buscar token en BD para obtener userId (CSRF ya validó)
      // IMPORTANTE: usar HMAC hash como en auth.service.js
      const tokenHash = hashTokenHelper(refreshToken);
      const storedToken = await userRepo.findRefreshTokenByHash(tokenHash);

      if (storedToken) {
        await authService.logout(storedToken.user_id, refreshToken);
      }
    }

    clearRefreshTokenCookie(res);
    clearCsrfTokenCookie(res);  // ⚠️ IMPORTANTE: borrar CSRF también
    res.json({ message: 'Logout exitoso' });
  } catch (error) {
    clearRefreshTokenCookie(res);
    clearCsrfTokenCookie(res);
    res.status(500).json({
      error: 'Error en logout',
      code: 'LOGOUT_ERROR'
    });
  }
});

export default router;