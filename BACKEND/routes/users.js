// ═══════════════════════════════════════════════════════════════════════════════
// RUTAS: USUARIOS
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Define rutas para gestionar usuarios (registro, perfil, estadísticas).
// Incluye rutas públicas (registro) y protegidas (perfil).
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();

// Importar controlador de usuarios
const usersController = require('../controllers/users_api_controller');

// ─── RUTAS PÚBLICAS ────────────────────────────────────────────────────────────
// POST /users: Crear nuevo usuario (registro)
// No requiere autenticación
router.post('/', usersController.registerUser);

// ─── RUTAS PROTEGIDAS (requieren autenticación JWT) ────────────────────────────
// Todas las siguientes rutas requieren parámetro :id y token JWT válido

// GET /users/:id: Obtener información del usuario
router.get('/:id',          usersController.authMiddleware, usersController.getUser);

// PATCH /users/:id: Actualizar información del usuario (nombre, email, contraseña, tema)
router.patch('/:id',        usersController.authMiddleware, usersController.updateUser);

// DELETE /users/:id: Eliminar cuenta del usuario y todos sus eventos
router.delete('/:id',       usersController.authMiddleware, usersController.deleteUser);

// GET /users/:id/stats: Obtener estadísticas del usuario
// Retorna conteos de: eventos, recordatorios, fechas importantes
router.get('/:id/stats',    usersController.authMiddleware, usersController.getUserStats);

// Exportar el router de usuarios
module.exports = router;
