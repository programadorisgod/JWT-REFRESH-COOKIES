import { useState, useCallback } from 'react';
import { authService } from '../services/auth.js';

export function useTodos() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const fetchTodos = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await authService.request('/todos');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error trayendo todos');
      }
      
      setTodos(data.todos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  
  const createTodo = useCallback(async (title) => {
    setError(null);
    
    const response = await authService.request('/todos', {
      method: 'POST',
      body: JSON.stringify({ title })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error creando todo');
    }
    
    setTodos(prev => [data.todo, ...prev]);
    return data.todo;
  }, []);
  
  const updateTodo = useCallback(async (id, updates) => {
    setError(null);
    
    const response = await authService.request(`/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error actualizando todo');
    }
    
    setTodos(prev => 
      prev.map(todo => todo.id === id ? data.todo : todo)
    );
    return data.todo;
  }, []);
  
  const deleteTodo = useCallback(async (id) => {
    setError(null);
    
    const response = await authService.request(`/todos/${id}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error eliminando todo');
    }
    
    setTodos(prev => prev.filter(todo => todo.id !== id));
    return true;
  }, []);
  
  const toggleComplete = useCallback(async (todo) => {
    return updateTodo(todo.id, { completed: !todo.completed });
  }, [updateTodo]);
  
  return {
    todos,
    loading,
    error,
    fetchTodos,
    createTodo,
    updateTodo,
    deleteTodo,
    toggleComplete
  };
}

export default useTodos;