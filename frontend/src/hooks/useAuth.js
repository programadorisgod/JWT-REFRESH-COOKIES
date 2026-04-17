import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tokenRefreshTime, setTokenRefreshTime] = useState('');
  
  useEffect(() => {
    // Suscribirse a cambios de auth
    const unsubscribe = authService.subscribe(({ user, isAuthenticated }) => {
      setUser(user);
      setIsAuthenticated(isAuthenticated);
    });
    
    // Suscribirse al timer de refresh
    const unsubscribeTimer = authService.subscribeToTimer((time) => {
      setTokenRefreshTime(time);
    });
    
    // Check inicial de sesión
    authService.checkSession().then(refreshed => {
      setIsAuthenticated(refreshed);
      setUser(authService.getUser());
      setLoading(false);
    });
    
    return () => {
      unsubscribe();
      unsubscribeTimer();
    };
  }, []);
  
  const login = useCallback(async (email, password) => {
    const result = await authService.login(email, password);
    return result;
  }, []);
  
  const logout = useCallback(async () => {
    await authService.logout();
  }, []);

  const getTimeUntilRefresh = useCallback(() => {
    return authService.getTimeUntilRefresh();
  }, []);
  
  return { user, isAuthenticated, loading, login, logout, tokenRefreshTime, getTimeUntilRefresh };
}

export default useAuth;