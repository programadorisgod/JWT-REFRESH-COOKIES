import { verifyCsrfToken } from '../services/auth.service.js';

// Middleware CSRF - Double Submit Cookie Pattern
// Protege contra ataques CSRF en requests mutativos
export function csrfProtection(req, res, next) {
  // Solo aplicar a métodos mutativos
  const csrfSafeMethods = ['GET', 'HEAD', 'OPTIONS'];
  
  if (csrfSafeMethods.includes(req.method)) {
    return next();
  }
  
  // Obtener CSRF token de la cookie (enviado automáticamente por el navegador)
  const csrfCookie = req.cookies.csrf_token;
  
  // Obtener CSRF token del header (enviado por nuestro JS)
  const csrfHeader = req.headers['x-csrf-token'];
  
  // Ambos deben estar presentes
  if (!csrfCookie || !csrfHeader) {
    return res.status(403).json({
      error: 'CSRF token requerido',
      code: 'CSRF_MISSING'
    });
  }
  
  // Verificar que coincidan
  if (csrfCookie !== csrfHeader) {
    return res.status(403).json({
      error: 'CSRF token inválido',
      code: 'CSRF_INVALID'
    });
  }
  
  // Validar expiración y usuario
  if (req.user) {
    const valid = verifyCsrfToken(csrfHeader, req.user.userId);
    
    if (!valid) {
      return res.status(403).json({
        error: 'CSRF token expirado',
        code: 'CSRF_EXPIRED'
      });
    }
  }
  
  next();
}

// Generador de opciones CSRF para respuestas
export function getCsrfOptions(csrfToken) {
  return {
    csrfToken,
    cookieOptions: {
      name: 'csrf_token',
      httpOnly: false,  // Accesible desde JS
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000
    }
  };
}