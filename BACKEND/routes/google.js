// ═══════════════════════════════════════════════════════════════════════════════
// RUTAS: AUTENTICACIÓN CON GOOGLE
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Define rutas para el flujo OAuth 2.0 con Google Calendar.
// Maneja la autorización y el callback de Google.
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();

// Importar controlador de Google y middleware de autenticación
const googleController = require('../controllers/google_api_controller');
const usersController = require('../controllers/users_api_controller');

// ─── RUTAS DE AUTENTICACIÓN CON GOOGLE ──────────────────────────────────────────

// GET /auth/google/url: Obtener URL de autorización de Google Calendar
// Requiere autenticación JWT
// Retorna URL que el usuario debe visitar para autorizar la aplicación
router.get('/google/url', usersController.authGenericMiddleware, googleController.getAuthUrl);

// GET /auth/google/callback: Callback de Google OAuth
// Ruta pública que Google invoca después de que el usuario autoriza
// Parámetros de consulta:
//   - code: código de autorización de Google
//   - state: ID del usuario (pasado en la URL de autorización)
router.get('/google/callback', googleController.handleCallback);

// Exportar el router de autenticación
module.exports = router;
