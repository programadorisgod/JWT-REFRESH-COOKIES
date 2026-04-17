import express from 'express';
import * as todoRepo from '../models/user.repository.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { csrfProtection } from '../middleware/csrf.middleware.js';

const router = express.Router();

// Aplicar auth a todas las rutas
router.use(authenticate);

// ===== GET /todos =====
router.get('/', async (req, res) => {
  try {
    // AISLAMIENTO: usar userId del token, NO del request
    const todos = await todoRepo.getTodosByUserId(req.user.userId);
    
    res.json({ todos });
  } catch (error) {
    res.status(500).json({
      error: 'Error obteniendo todos',
      code: 'GET_ERROR'
    });
  }
});

// ===== POST /todos =====
router.post('/', csrfProtection, async (req, res) => {
  try {
    const { title } = req.body;
    
    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        error: 'Título requerido',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // AISLAMiento: usar userId del token
    const todo = await todoRepo.createTodo(req.user.userId, title.trim());
    
    res.status(201).json({ todo });
  } catch (error) {
    res.status(500).json({
      error: 'Error creando todo',
      code: 'CREATE_ERROR'
    });
  }
});

// ===== PUT /todos/:id =====
router.put('/:id', csrfProtection, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, completed } = req.body;
    
    // Validar que venga al menos un campo
    if (title === undefined && completed === undefined) {
      return res.status(400).json({
        error: 'Título o completed requerido',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // AISLAMiento: filtrar por userId del token
    const updatedTodo = await todoRepo.updateTodo(
      id,
      req.user.userId,
      title?.trim(),
      completed
    );
    
    if (!updatedTodo) {
      return res.status(404).json({
        error: 'Todo no encontrado',
        code: 'NOT_FOUND'
      });
    }
    
    res.json({ todo: updatedTodo });
  } catch (error) {
    res.status(500).json({
      error: 'Error actualizando todo',
      code: 'UPDATE_ERROR'
    });
  }
});

// ===== DELETE /todos/:id =====
router.delete('/:id', csrfProtection, async (req, res) => {
  try {
    const { id } = req.params;
    
    // AISLAMiento: filtrar por userId del token
    const deletedTodo = await todoRepo.deleteTodo(id, req.user.userId);
    
    if (!deletedTodo) {
      return res.status(404).json({
        error: 'Todo no encontrado',
        code: 'NOT_FOUND'
      });
    }
    
    res.json({ message: 'Todo eliminado' });
  } catch (error) {
    res.status(500).json({
      error: 'Error eliminando todo',
      code: 'DELETE_ERROR'
    });
  }
});

export default router;