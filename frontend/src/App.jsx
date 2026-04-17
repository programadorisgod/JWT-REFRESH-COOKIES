import { useAuth } from './hooks/useAuth.js';
import LoginForm from './components/LoginForm.jsx';
import TodoList from './components/TodoList.jsx';

function App() {
  const { user, isAuthenticated, loading, login, logout, tokenRefreshTime } = useAuth();
  
  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center' }}>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="container">
        <LoginForm onLogin={login} />
      </div>
    );
  }
  
  return (
    <div className="container">
      <header>
        <div className="user-info">
          <h1>Mis Tareas</h1>
          {/* Indicador visual de refresh del token */}
          {tokenRefreshTime && (
            <div className="token-timer">
              <span className="timer-label">🔄 Token refresh en:</span>
              <span className="timer-value">{tokenRefreshTime}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="user-email">{user?.email}</span>
          <button className="btn btn-logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>
      
      <TodoList />
    </div>
  );
}

export default App;