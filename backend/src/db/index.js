import pg from 'pg';
import { dbConfig } from '../config/index.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: dbConfig.connectionString,
  ssl: dbConfig.ssl
});

// Inicializar tablas
export async function initDatabase() {
  try {
    // Tabla users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla todos (con user_id para aislamiento)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla refresh_tokens (para revocación - modelo opaco)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL,  -- HMAC-SHA256 hash
        jti VARCHAR(36) NOT NULL,       -- token ID único
        ip VARCHAR(45),               -- IP del cliente
        revoked BOOLEAN DEFAULT FALSE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP          -- Auditoría: último uso
      )
    `);

    // Crear índice para búsquedas rápidas
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)
    `);

    console.log('✅ Base de datos inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error.message);
    throw error;
  }
}

// Query helper con logging
export async function query(text, params) {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('❌ Query error:', error.message);
    throw error;
  }
}