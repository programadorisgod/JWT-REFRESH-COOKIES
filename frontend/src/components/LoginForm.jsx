import { useState } from 'react';
import { authService } from '../services/auth.js';

export function LoginForm({ onLogin, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setLoading(true);
    
    try {
      await onLogin(email, password);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="card login-form">
      <div className="login-header">
        <h2>Bienvenido</h2>
        <p>Inicia sesión con tu cuenta</p>
      </div>
      
      {(localError || error) && (
        <div className="error">{localError || error}</div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            disabled={loading}
          />
        </div>
        
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={loading}
          />
        </div>
        
        <button 
          type="submit" 
          className="btn btn-primary btn-full"
          disabled={loading}
        >
          {loading ? 'Iniciando...' : 'Iniciar sesión'}
        </button>
      </form>
    </div>
  );
}

export default LoginForm;