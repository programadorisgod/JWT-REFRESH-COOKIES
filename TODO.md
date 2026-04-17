# 🚀 TODO - Sistema de Autenticación con Tokens Opaques

> **Estado actual**: Sistema production-ready con tokens opacos, rotación, CSRF, rate limiting y auditoría.

---

## ✅ Completado Hoy

### Seguridad Core
- [x] Access token en memoria (NO localStorage)
- [x] Refresh token opaco (NO JWT) - 64 bytes random
- [x] Hash HMAC-SHA256 con server secret
- [x] Rotación real de refresh token (invalida anterior)
- [x] Detección de reuse → invalidate all sessions
- [x] CSRF protection en todos los endpoints con cookies
- [x] Rate limiting por IP
- [x] Cookie httpOnly + secure + SameSite=Strict
- [x] Cookie scope: `path=/api/auth/refresh`
- [x] CSP headers endurecidos
- [x] HSTS header

### Auditoría y Límites
- [x] IP tracking (soft logging, no bloqueo)
- [x] `last_used_at` timestamp
- [x] Límite de 5 sesiones por usuario
- [x] JTI único por token (forense)

### Gestión de Sesiones
- [x] Endpoint `GET /api/me/sessions` - listar sesiones activas
- [x] Endpoint `DELETE /api/me/sessions/:id` - revocar sesión específica
- [x] Endpoint `DELETE /api/me/sessions` - logout global

### Robustez
- [x] Race condition handling en refresh (UPDATE ... WHERE revoked=false)
- [x] Sliding expiration configurado
- [x] Clear cookie con flags exactos

---

## 🔜 Próximos Pasos (Prioridad Alta)

### 1. Device Fingerprinting
**Archivos**: `backend/src/services/auth.service.js`

```javascript
// Detectar cambio de dispositivo
function generateDeviceFingerprint(req) {
  const components = [
    req.headers['user-agent'],
    req.headers['accept-language'],
    req.headers['accept-encoding']
  ];
  return crypto.createHash('sha256')
    .update(components.join('|'))
    .digest('hex');
}

// Alertar si el fingerprint cambia drásticamente
```

### 2. Webhook de Seguridad
**Archivo nuevo**: `backend/src/services/security.webhook.js`

- Notificar en tiempo real cuando:
  - Reuse attack detectado
  - IP cambia entre países (VPN/Tor detection)
  - Múltiples sesiones desde diferentes continentes
- Integración: Slack, Discord, Email

### 3. Geo-IP Validation (opcional)
**Archivo**: `backend/src/services/auth.service.js`

```javascript
// Detectar cambios imposibles (e.g., login desde NY y Tokio en 1 hora)
if (geoDistance(storedIP, currentIP) > 1000 && timeDelta < 1) {
  alertSuspiciousActivity();
}
```

### 4. Refresh Token Family (mejora de reuse detection)
**Archivo**: `backend/src/models/user.repository.js`

```sql
-- Agregar family_id para detectar árbol de rotación
ALTER TABLE refresh_tokens ADD COLUMN family_id UUID;
```

Permite detectar qué token inició una cadena de rotación.

### 5. Frontend: UI de Sesiones
**Archivos**: `frontend/src/components/SessionsList.jsx`

- Mostrar lista de sesiones activas
- Botón "Cerrar sesión" por dispositivo
- Indicador "Sesión actual"
- Opción "Cerrar todas las demás"

### 6. Endpoint: Validación de Token Activo
**Archivo**: `backend/src/routes/auth.routes.js`

```javascript
// GET /api/auth/validate
// Verifica si el access token es válido sin refrescar
// Útil para verificar estado antes de acciones críticas
```

---

## 🔮 Mejoras Futuras (Nice to Have)

### Seguridad Avanzada
- [ ] **Hardware Tokens**: Soporte para WebAuthn/FIDO2
- [ ] **TOTP**: 2FA con Google Authenticator
- [ ] **Magic Links**: Login sin password (email)
- [ ] **Biometric**: Integración con Web Biometric API

### Operaciones
- [ ] **Redis**: Cache de tokens activos (mejor performance)
- [ ] **Webhook Events**: `session.created`, `session.revoked`, `reuse.detected`
- [ ] **Metrics**: Prometheus metrics para monitoreo
- [ ] **Audit Log**: Tabla separada para logs de seguridad (inmutable)

### UX
- [ ] **Remember Device**: Skip 2FA en dispositivos confiados
- [ ] **Session Notifications**: Email cuando se crea nueva sesión
- [ ] **Inactive Timeout**: Auto-logout después de 30 min inactivo

---

## 🐛 Bugs Conocidos / Edge Cases

### Por Verificar
- [ ] **Logout sin sesión**: Si el usuario hace logout sin tener sesión activa, ¿limpia cookies huérfanas?
- [ ] **Concurrent Refresh**: Ya implementado race-safe, pero verificar en tests de carga
- [ ] **Timezone**: `last_used_at` usa server time, no UTC explícito

### Tests Necesarios
```javascript
// 1. Race condition test
Promise.all([
  fetch('/api/auth/refresh', { credentials: 'include' }),
  fetch('/api/auth/refresh', { credentials: 'include' })
]);
// Esperado: Una gana (200), otra pierde (401)

// 2. Reuse detection test
const refreshToken = getCookie('refreshToken');
await fetch('/api/auth/refresh'); // Éxito, rota token
await fetch('/api/auth/refresh', {
  headers: { 'Cookie': `refreshToken=${refreshToken}` }
}); // Falla, token revocado
// Esperado: 401 + invalidate all sessions

// 3. CSRF test
await fetch('/api/auth/refresh', {
  credentials: 'include'
  // Sin X-CSRF-Token header
});
// Esperado: 403
```

---

## 📚 Documentación Pendiente

### Para Developers
- [ ] **API Spec**: OpenAPI/Swagger de todos los endpoints
- [ ] **Security Guide**: Cómo funciona el sistema paso a paso
- [ ] **Deployment**: Checklist de producción (env vars, DB, etc.)

### Para Usuarios
- [ ] **FAQ**: "¿Por qué se cierra mi sesión?"
- [ ] **Security Tips**: Usar 2FA, revisar sesiones activas

---

## 🗃️ Schema de BD (Actualizado)

```sql
-- Tabla refresh_tokens completa
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,     -- HMAC-SHA256
    jti VARCHAR(36) NOT NULL UNIQUE,     -- ID único
    family_id UUID,                      -- Para árbol de rotación (futuro)
    ip VARCHAR(45),                      -- IPv4 o IPv6
    device_fingerprint VARCHAR(64),      -- Hash de device (futuro)
    revoked BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP               -- Auditoría
);

-- Índices
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_jti ON refresh_tokens(jti);
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens(user_id, revoked, expires_at);
```

---

## 🎯 Métricas de Éxito

- [ ] **0** tokens JWT en cliente (solo access en memoria)
- [ ] **0** datos sensibles en localStorage
- [ ] **100%** requests mutativos con CSRF válido
- [ ] **<50ms** lookup de refresh token (con índices)
- [ ] **0** race conditions detectados en tests

---

## 📞 Contacto / Soporte

Si encontrás vulnerabilidades:
1. No abrir issue público
2. Email a: security@tudominio.com
3. O usar GitHub Security Advisories

---

**Última actualización**: Hoy  
**Versión**: v1.0-production-ready  
**Estado**: 🟢 Operativo