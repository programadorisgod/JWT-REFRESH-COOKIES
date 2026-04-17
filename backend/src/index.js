import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

// Importar configuraciones
import { dbConfig } from './config/index.js';

// Importar rutas
import authRoutes from './routes/auth.routes.js';
import todoRoutes from './routes/todo.routes.js';
import meRoutes from './routes/me.routes.js';

// Importar middlewares de seguridad
import { cspMiddleware, securityHeadersMiddleware } from './middleware/security.headers.js';

// Importar DB
import { initDatabase } from './db/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ===== MIDDLEWARES =====

// CORS - permitir solo el frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

// Parser de cookies (NECESARIO para leer refresh token cookie)
app.use(cookieParser());

// Parser JSON
app.use(express.json());

// ===== SECURITY HEADERS =====
app.use(cspMiddleware);
app.use(securityHeadersMiddleware);

// ===== RATE LIMITING =====

// Rate limit para login (prevenir brute force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 5,                  // 5 intentos
  message: {
    error: 'Demasiados intentos de login',
    code: 'RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit para refresh (prevenir滥用)
const refreshLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minuto
  max: 10,                 // 10 refreshes por minuto
  message: {
    error: 'Demasiadas solicitudes de refresh',
    code: 'RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ===== RUTAS =====

// montamos las rutas con prefijo /api/auth
app.use('/api/auth', authRoutes);

// Todo routes
app.use('/api/todos', todoRoutes);

// Me routes (sesiones del usuario)
app.use('/api/me', meRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== INICIAR SERVIDOR =====

async function start() {
  try {
    // Inicializar DB
    await initDatabase();
    console.log('✅ Conectado a PostgreSQL Neon');
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
      console.log(`📝 Endpoints:`);
      console.log(`   - POST /api/auth/login`);
      console.log(`   - POST /api/auth/refresh`);
      console.log(`   - POST /api/auth/logout`);
      console.log(`   - GET  /api/me/sessions`);
      console.log(`   - DELETE /api/me/sessions/:id`);
      console.log(`   - DELETE /api/me/sessions (logout global)`);
      console.log(`   - GET  /api/todos`);
      console.log(`   - POST /api/todos`);
      console.log(`   - PUT  /api/todos/:id`);
      console.log(`   - DELETE /api/todos/:id`);
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

start();