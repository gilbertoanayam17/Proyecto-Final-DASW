// ═══════════════════════════════════════════════════════════════════════════════
// RUTAS: EVENTOS
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Define todas las rutas para gestionar eventos (CRUD).
// Todas las rutas requieren autenticación con JWT.
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();

// Importar controlador de eventos y middleware de autenticación
const eventsController = require('../controllers/events_api_controller');
const { authGenericMiddleware } = require('../controllers/users_api_controller');

// ─── MIDDLEWARE DE AUTENTICACIÓN ────────────────────────────────────────────────
// Todas las rutas de eventos requieren un token JWT válido en el header Authorization
router.use(authGenericMiddleware);

// ─── RUTAS CRUD DE EVENTOS ──────────────────────────────────────────────────────

// POST /events: Crear un nuevo evento
// Parámetros esperados: title, description, type, date, start_time, end_time, recurrence
router.post('/',            eventsController.createEvent);

// GET /events: Obtener eventos del usuario
// Parámetros de consulta opcionales:
//   - type: filtrar por tipo ('evento', 'recordatorio', 'fecha_importante')
//   - start: inicio de rango de fechas (YYYY-MM-DD)
//   - end: fin de rango de fechas (YYYY-MM-DD)
//   - month: filtrar por mes (YYYY-MM)
//   - day: filtrar por día (YYYY-MM-DD)
router.get('/',             eventsController.getEvents);

// GET /events/today: Obtener eventos de hoy
router.get('/today',        eventsController.getEventsToday);

// GET /events/search: Buscar eventos por criterios
// Parámetros de consulta:
//   - q: búsqueda de texto en título/descripción
//   - type: filtrar por tipo de evento
//   - start, end: rango de fechas
//   - sort: ordenar por 'date' o 'title'
router.get('/search',       eventsController.searchEvents);

// GET /events/:id: Obtener un evento específico por su ID
router.get('/:id',          eventsController.getEvent);

// PATCH /events/:id: Actualizar un evento existente
router.patch('/:id',        eventsController.updateEvent);

// DELETE /events/:id: Eliminar un evento
router.delete('/:id',       eventsController.deleteEvent);

// Exportar el router de eventos
module.exports = router;
