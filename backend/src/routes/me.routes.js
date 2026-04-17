import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as userRepo from '../models/user.repository.js';

const router = express.Router();

// ===== GET /me/sessions =====
// Listar sesiones activas del usuario autenticado
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const sessions = await userRepo.getUserSessions(req.user.userId);

    // Formatear para el frontend (sin hashes sensibles)
    const formattedSessions = sessions.map(session => ({
      id: session.id,
      jti: session.jti,
      ip: session.ip,
      createdAt: session.created_at,
      lastUsedAt: session.last_used_at,
      expiresAt: session.expires_at,
      isCurrent: false // Se marcará después
    }));

    res.json({
      sessions: formattedSessions,
      count: formattedSessions.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error obteniendo sesiones',
      code: 'SESSIONS_ERROR'
    });
  }
});

// ===== DELETE /me/sessions/:id =====
// Revocar una sesión específica (logout remoto)
router.delete('/sessions/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la sesión pertenezca al usuario
    const session = await userRepo.findSessionById(id);

    if (!session || session.user_id !== req.user.userId) {
      return res.status(404).json({
        error: 'Sesión no encontrada',
        code: 'SESSION_NOT_FOUND'
      });
    }

    // Revocar la sesión
    await userRepo.revokeRefreshToken(session.id);

    res.json({
      message: 'Sesión revocada exitosamente',
      sessionId: id
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error revocando sesión',
      code: 'REVOKE_ERROR'
    });
  }
});

// ===== DELETE /me/sessions =====
// Revocar TODAS las sesiones excepto la actual (logout global)
router.delete('/sessions', authenticate, async (req, res) => {
  try {
    // TODO: Necesitamos identificar la sesión actual por el refresh token
    // Por ahora invalidamos todas (incluyendo la actual)
    await userRepo.deleteAllUserRefreshTokens(req.user.userId);

    res.json({
      message: 'Todas las sesiones han sido revocadas',
      action: 'GLOBAL_LOGOUT'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error revocando sesiones',
      code: 'REVOKE_ALL_ERROR'
    });
  }
});

export default router;