import { query } from '../db/index.js';
import bcrypt from 'bcrypt';

async function seedDatabase() {
  try {
    // Crear usuario de prueba
    const hashedPassword = await bcrypt.hash('test123', 12);
    
    await query(`
      INSERT INTO users (email, password) 
      VALUES ($1, $2) 
      ON CONFLICT (email) DO NOTHING
    `, ['test@test.com', hashedPassword]);
    
    console.log('✅ Usuario de prueba creado: test@test.com / test123');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

seedDatabase();