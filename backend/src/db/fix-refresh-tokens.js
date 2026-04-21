import { pool } from './index.js';

async function fixRefreshTokensTable() {
  try {
    // Verificar si la columna "token" existe
    const { rows } = await pool.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'refresh_tokens' AND column_name = 'token'
    `);
    
    if (rows.length === 0) {
      console.log('✅ La columna "token" no existe en refresh_tokens. Todo OK.');
    } else {
      console.log('📋 Columna "token" encontrada, is_nullable =', rows[0].is_nullable);
      
      if (rows[0].is_nullable === 'NO') {
        // Hacer la columna nullable
        await pool.query(`ALTER TABLE refresh_tokens ALTER COLUMN token DROP NOT NULL`);
        console.log('✅ Columna "token" ahora permite NULL');
      }
    }
    
    // Verificar si hay columna "token" que ya no se usa (opcional: dropear)
    // await pool.query(`ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS token`);
    // console.log('✅ Columna "token" eliminada (ya no se usa en modelo opaco)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixRefreshTokensTable();
