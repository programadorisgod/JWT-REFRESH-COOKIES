import { verifyAccessToken } from '../services/auth.service.js';

// Middleware de autenticación - protege endpoints
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'No autorizado',
      code: 'MISSING_TOKEN'
    });
  }
  
  const token = authHeader.substring(7);
  const decoded = verifyAccessToken(token);
  
  if (!decoded) {
    return res.status(401).json({ 
      error: 'Token expirado o inválido',
      code: 'INVALID_TOKEN'
    });
  }
  
  // Injectar usuario en request (NUNCA confiar en datos del frontend)
  req.user = {
    userId: decoded.userId,
    email: decoded.email
  };
  
  next();
}