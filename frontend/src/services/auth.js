const API_URL = '/api';

class AuthService {
  constructor() {
    // Access token en MEMORIA (NUNCA en localStorage)
    this.accessToken = null;
    this.user = null;
    this.csrfToken = null;
    
    // Timestamps para el indicador visual
    this.lastRefreshTime = null;
    this.accessTokenExpiry = 5 * 60 * 1000; // 5 minutos en ms
    
    // Callbacks para notify cambios de estado
    this.listeners = new Set();
    
    // 🔒 Prevención de refresh concurrente (evita token reuse)
    this.refreshingPromise = null;
  }
  
  // Observer pattern para cambios de autenticación
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  notifyListeners() {
    this.listeners.forEach(cb => cb({ user: this.user, isAuthenticated: !!this.accessToken }));
  }
  
  // ===== CSRF TOKEN =====
  
  // Leer CSRF token de cookie (accessible desde JS)
  getCsrfTokenFromCookie() {
    const name = 'csrf_token=';
    const decoded = decodeURIComponent(document.cookie);
    const ca = decoded.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(name) === 0) {
        return c.substring(name.length, c.length);
      }
    }
    return null;
  }
  
  // ===== API HELPERS =====
  
  // Headers con access token y CSRF
  async getHeaders(isMutative = false) {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Access token en memoria
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    
    // CSRF token para requests mutativas
    if (isMutative) {
      const csrf = this.getCsrfTokenFromCookie();
      if (csrf) {
        headers['X-CSRF-Token'] = csrf;
      }
    }
    
    return headers;
  }
  
  // Request wrapper con auto-refresh
  async request(endpoint, options = {}) {
    const isMutative = ['POST', 'PUT', 'DELETE'].includes(options.method || 'GET');
    const headers = await this.getHeaders(isMutative);
    
    let response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
      credentials: 'include'  // Para enviar cookies
    });
    
    // Si access token expirado, intentar refresh
    if (response.status === 401 && options.retry !== false) {
      const refreshed = await this.refreshSession();
      
      if (refreshed) {
        // Reintentar request
        const newHeaders = await this.getHeaders(isMutative);
        response = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers: { ...newHeaders, ...options.headers },
          credentials: 'include'
        });
      } else {
        // No se pudo refresh, clear session
        this.logout();
        return response;
      }
    }
    
    return response;
  }
  
  // ===== AUTH METHODS =====
  
  async login(email, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Login fallido');
    }
    
    // Guardar access token en MEMORIA
    this.accessToken = data.accessToken;
    this.user = data.user;
    this.csrfToken = this.getCsrfTokenFromCookie();
    
    // IMPORTANTE: Registrar tiempo de login para el timer visual
    this.lastRefreshTime = Date.now();
    
    this.notifyListeners();
    return data;
  }
  
  async refreshSession() {
    // 🔒 Si ya hay un refresh en progreso, devolver la misma promesa
    // Esto previene "token reuse" cuando múltiples requests disparan refresh
    if (this.refreshingPromise) {
      return this.refreshingPromise;
    }

    // IMPORTANTE: La cookie refreshToken es httpOnly, NO podemos leerla desde JS.
    // Simplemente intentamos el refresh - el backend verificará la cookie.
    // Si no hay cookie o está inválida, el backend devolverá 401.
    // CSRF token se envía desde la cookie (no httpOnly) para protección CSRF
    
    // 🔒 Crear la promesa de refresh
    this.refreshingPromise = (async () => {
      try {
        const csrf = this.getCsrfTokenFromCookie();
        const headers = {
          'Content-Type': 'application/json'
        };
        if (csrf) {
          headers['X-CSRF-Token'] = csrf;
        }
        
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers,
          credentials: 'include'
        });
        
        if (!response.ok) {
          // Limpiar estado si el refresh falla
          this.accessToken = null;
          this.user = null;
          this.notifyListeners();
          return false;
        }
        
        const data = await response.json();
        
        // Actualizar access token en MEMORIA
        this.accessToken = data.accessToken;
        this.user = data.user;
        this.csrfToken = this.getCsrfTokenFromCookie();
        
        // Registrar tiempo de refresh para el indicador visual
        this.lastRefreshTime = Date.now();
        
        this.notifyListeners();
        return true;
      } catch (error) {
        return false;
      } finally {
        // 🔒 Liberar el lock
        this.refreshingPromise = null;
      }
    })();

    return this.refreshingPromise;
  }
  
  async logout() {
    try {
      // Logout也需要CSRF token (mutative request)
      const headers = await this.getHeaders(true);
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers,
        credentials: 'include'
      });
    } catch {
      // Ignorar errores en logout
    }
    
    // Limpiar memoria
    this.accessToken = null;
    this.user = null;
    this.csrfToken = null;
    
    this.notifyListeners();
  }
  
  // ===== CHECK SESSION =====
  
  async checkSession() {
    // Intentar refresh al inicio (para persistencia en reload)
    const refreshed = await this.refreshSession();
    return refreshed;
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  getUser() {
    return this.user;
  }

  // ===== TIMERS PARA VISUALIZACIÓN =====

  // Obtener tiempo restante hasta próximo refresh (en ms)
  getTimeUntilRefresh() {
    if (!this.lastRefreshTime) return 0;
    const elapsed = Date.now() - this.lastRefreshTime;
    return Math.max(0, this.accessTokenExpiry - elapsed);
  }

  // Obtener tiempo restante formateado (mm:ss)
  getTimeUntilRefreshFormatted() {
    const ms = this.getTimeUntilRefresh();
    if (ms <= 0) return 'Refrescando...';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Subscribe al timer para UI
  subscribeToTimer(callback) {
    let refreshTriggered = false; // Evitar múltiples refresh
    
    const interval = setInterval(() => {
      // Si no hay sesión activa, no intentar refresh
      if (!this.accessToken) return;
      
      const ms = this.getTimeUntilRefresh();
      
      // Proactive refresh: 30 segundos antes de que expire
      if (ms > 0 && ms < 30 * 1000 && !refreshTriggered) {
        refreshTriggered = true; // Marcar que ya se intentó refresh
        this.refreshSession().then(success => {
          if (!success) {
            // Si falló, limpiar sesión
            this.logout();
          }
          refreshTriggered = false; // Reset para próximo refresh
        });
      }
      
      callback(this.getTimeUntilRefreshFormatted());
    }, 1000);
    return () => clearInterval(interval);
  }
}

// Singleton
export const authService = new AuthService();