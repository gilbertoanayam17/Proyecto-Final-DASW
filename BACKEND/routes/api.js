// ═══════════════════════════════════════════════════════════════════════════════
// RUTAS PRINCIPALES - API
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Router central que organiza todas las rutas de la aplicación.
// Incluye rutas para: autenticación, usuarios, eventos, Google Calendar, y vistas.
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const path = require('path');
const router = express.Router();

// Importar routers de recursos específicos
const usersRouter = require('./users'); // Router de usuarios
const eventsRouter = require('./events'); // Router de eventos
const usersController = require('../controllers/users_api_controller'); // Controlador de usuarios
const authRouter = require('./google'); // Router de autenticación con Google

// ─── RUTAS DE AUTENTICACIÓN ─────────────────────────────────────────────────────
// POST /login: Ruta pública para iniciar sesión con email y contraseña
router.post('/login', usersController.login);

// ─── ENRUTADOR DE RECURSOS ──────────────────────────────────────────────────────
// Prefijo /users: incluye rutas para gestionar usuarios
router.use('/users',  usersRouter);

// Prefijo /events: incluye rutas para gestionar eventos
router.use('/events', eventsRouter);

// Prefijo /auth: incluye rutas de autenticación (Google Calendar)
router.use('/auth', authRouter);

// ─── RUTAS DEL FRONTEND (VISTAS HTML) ────────────────────────────────────────────
// Definir ruta base del directorio de vistas del frontend
const VIEWS = path.resolve(__dirname, '../../FRONTEND/views');

// GET /: Página de inicio (redirige a login.html)
router.get('/',                (req, res) => res.sendFile(`${VIEWS}/login.html`));

// GET /login: Página de inicio de sesión
router.get('/login',           (req, res) => res.sendFile(`${VIEWS}/login.html`));

// GET /calendar: Página del calendario (vista mensual por defecto)
router.get('/calendar',        (req, res) => res.sendFile(`${VIEWS}/monthly_view.html`));

// GET /calendar/month: Vista del calendario por mes
router.get('/calendar/month',  (req, res) => res.sendFile(`${VIEWS}/monthly_view.html`));

// GET /calendar/week: Vista del calendario por semana
router.get('/calendar/week',   (req, res) => res.sendFile(`${VIEWS}/weekly_view.html`));

// GET /calendar/day: Vista del calendario por día
router.get('/calendar/day',    (req, res) => res.sendFile(`${VIEWS}/daily_view.html`));

// GET /search: Página de búsqueda avanzada de eventos
router.get('/search',          (req, res) => res.sendFile(`${VIEWS}/advanced_search.html`));

// GET /profile: Página de perfil del usuario
router.get('/profile',         (req, res) => res.sendFile(`${VIEWS}/user_profile.html`));

// Exportar el router principal
module.exports = router;
