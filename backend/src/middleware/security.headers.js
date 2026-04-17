// Security Headers - Protege contra XSS, clickjacking, etc.

// Content Security Policy (endurecida)
export function cspMiddleware(req, res, next) {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +           // Solo mismo dominio
    "script-src 'self'; " +           // Solo JS propio (no inline)
    "style-src 'self' 'unsafe-inline'; " + // Inline para estilos (necesario)
    "img-src 'self' data:; " +      // Imágenes locales + data URIs
    "connect-src 'self'; " +         // Solo API mismo dominio
    "object-src 'none'; " +         // No objects/embeds
    "base-uri 'self'; " +           // No base tag injection
    "frame-ancestors 'none'; " +    // No iframes externos
    "form-action 'self'"             // Solo forms locales
  );
  next();
}

// Other security headers
export function securityHeadersMiddleware(req, res, next) {
  // Previene clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Previene MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // HSTS - fuerza HTTPS (1 año, incluye subdominios)
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // Referrer policy - no enviar referrer a externos
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy - bloquear features sensibles
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=()'
  );

  next();
}