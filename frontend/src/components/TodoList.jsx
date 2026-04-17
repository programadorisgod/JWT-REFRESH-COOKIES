import { useState, useEffect } from 'react';
import { useTodos } from '../hooks/useTodos.js';

export function TodoList() {
  const {
    todos,
    loading,
    error,
    fetchTodos,
    createTodo,
    toggleComplete,
    deleteTodo
  } = useTodos();
  
  const [newTodo, setNewTodo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Fetch al inicio
  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newTodo.trim()) return;
    
    setSubmitting(true);
    
    try {
      await createTodo(newTodo);
      setNewTodo('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleToggle = async (todo) => {
    try {
      await toggleComplete(todo);
    } catch (err) {
      console.error(err);
    }
  };
  
  const handleDelete = async (id) => {
    try {
      await deleteTodo(id);
    } catch (err) {
      console.error(err);
    }
  };
  
  return (
    <div>
      {/* Form crear todo */}
      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Nueva tarea..."
            style={{ flex: 1 }}
            disabled={submitting}
          />
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={submitting || !newTodo.trim()}
          >
            {submitting ? '...' : 'Agregar'}
          </button>
        </form>
      </div>
      
      {/* Error global */}
      {error && <div className="error">{error}</div>}
      
      {/* Loading inicial */}
      {loading && todos.length === 0 && (
        <div className="empty-state">Cargando...</div>
      )}
      
      {/* Lista de todos */}
      {todos.length === 0 && !loading ? (
        <div className="empty-state">
          <p>No hay tareas todavía</p>
          <p>Crea tu primera tarea arriba</p>
        </div>
      ) : (
        <div>
          {todos.map(todo => (
            <div 
              key={todo.id} 
              className={`todo-item ${todo.completed ? 'completed' : ''}`}
            >
              <input
                type="checkbox"
                className="todo-checkbox"
                checked={todo.completed}
                onChange={() => handleToggle(todo)}
              />
              <span className="todo-title">{todo.title}</span>
              <button
                className="btn-delete"
                onClick={() => handleDelete(todo.id)}
                title="Eliminar"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TodoList;