const Event = require('../models/event');
const User = require('../models/user');
const googleService = require('../services/google_calendar_service');

function parseDateOnlyUtcStart(value) {
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function parseDateOnlyUtcEnd(value) {
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLADOR: API DE EVENTOS
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Centraliza la lógica de negocio de los eventos del calendario.
// Permite crear, consultar, buscar, actualizar y eliminar eventos, además de
// expandir recurrencias y sincronizar con Google Calendar cuando corresponde.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── CREAR EVENTO ──────────────────────────────────────────────────────────────

/**
 * Crea un evento nuevo para el usuario autenticado.
 * Valida campos básicos, normaliza valores y luego intenta sincronizar con
 * Google Calendar si la cuenta del usuario está conectada.
 * @param {Object} req - Solicitud HTTP con el evento en `body`.
 * @param {Object} res - Respuesta HTTP.
 */
exports.createEvent = async (req, res) => {
    try {
        const userId = req.user._id;
        const { title, description, type, date, start_time, end_time, recurrence, recurrence_end, completed } = req.body;

        if (!title) return res.status(400).json({ error: 'El título es obligatorio' });
        if (!date) return res.status(400).json({ error: 'La fecha es obligatoria' });

        const validTypes = ['evento', 'recordatorio', 'fecha_importante'];
        if (type && !validTypes.includes(type))
            return res.status(400).json({ error: 'Tipo de evento inválido' });

        const event = new Event({
            title,
            description: description || '',
            type: type || 'evento',
            date: new Date(date),
            start_time: start_time || null,
            end_time: end_time || null,
            recurrence: recurrence || 'none',
            recurrence_end: recurrence_end ? new Date(recurrence_end) : null,
            completed: completed === true || completed === 'true',
            user_id: userId
        });

        await event.save();

        // Auto-sync con Google Calendar si el usuario está conectado y no se desactivó
        try {
            const user = await User.findById(userId);
            const shouldSync = req.body.sync_google === undefined ? true : (req.body.sync_google === true || req.body.sync_google === 'true');
            if (user?.google?.connected && shouldSync) {
                try {
                    const timeZone = req.body.timeZone || 'UTC';
                    const gid = await googleService.createEvent(user, event, timeZone);
                    if (gid) {
                        event.google = event.google || {};
                        event.google.id = gid;
                        await event.save();
                    }
                } catch (gErr) {
                    console.error('Google sync create failed:', gErr.message || gErr);
                }
            }
        } catch (errSync) {
            console.error('Error checking Google sync:', errSync.message || errSync);
        }

        res.status(201).json({ message: 'Evento creado', event });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const msg = Object.values(err.errors).map(e => e.message).join(', ');
            return res.status(400).json({ error: msg });
        }
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// ─── CONSULTAR EVENTOS ──────────────────────────────────────────────────────────

/**
 * Devuelve los eventos del usuario aplicando filtros opcionales por tipo,
 * rango de fechas, mes o día específico.
 * @param {Object} req - Solicitud HTTP con filtros en `query`.
 * @param {Object} res - Respuesta HTTP.
 */
exports.getEvents = async (req, res) => {
    try {
        const userId = req.user._id;
        const filter = { user_id: userId };

        // Filtro por tipo
        if (req.query.type) filter.type = req.query.type;

        // Filtro por rango de fechas
        if (req.query.start || req.query.end) {
            filter.date = {};
            if (req.query.start) filter.date.$gte = parseDateOnlyUtcStart(req.query.start);
            if (req.query.end)   filter.date.$lte = parseDateOnlyUtcEnd(req.query.end);
        }

        // Filtro por mes (YYYY-MM)
        if (req.query.month) {
            const [year, month] = req.query.month.split('-').map(Number);
            filter.date = {
                $gte: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
                $lte: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
            };
        }

        // Filtro por día (YYYY-MM-DD)
        if (req.query.day) {
            const d = parseDateOnlyUtcStart(req.query.day);
            filter.date = {
                $gte: d,
                $lte: parseDateOnlyUtcEnd(req.query.day)
            };
        }

        const events = await Event.find(filter).sort({ date: 1, start_time: 1 });

        // Expandir eventos recurrentes
        const expanded = expandRecurringEvents(events, filter.date);

        res.json(expanded);
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// ─── EVENTOS DE HOY ────────────────────────────────────────────────────────────

/**
 * Devuelve los eventos del día actual del usuario autenticado.
 * @param {Object} req - Solicitud HTTP.
 * @param {Object} res - Respuesta HTTP.
 */
exports.getEventsToday = async (req, res) => {
    try {
        const userId = req.user._id;
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

        const events = await Event.find({
            user_id: userId,
            date: { $gte: start, $lte: end }
        }).sort({ start_time: 1 });

        res.json(events);
    } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// ─── BUSCAR EVENTOS ────────────────────────────────────────────────────────────

/**
 * Busca eventos por texto, tipo, rango de fechas y criterio de ordenamiento.
 * @param {Object} req - Solicitud HTTP con criterios en `query`.
 * @param {Object} res - Respuesta HTTP.
 */
exports.searchEvents = async (req, res) => {
    try {
        const userId = req.user._id;
        const { q, type, start, end, sort } = req.query;

        const filter = { user_id: userId };

        if (q) {
            const regex = new RegExp(q, 'i');
            filter.$or = [{ title: regex }, { description: regex }];
        }

        if (type && type !== 'todos') filter.type = type;

        if (start || end) {
            filter.date = {};
            if (start) filter.date.$gte = parseDateOnlyUtcStart(start);
            if (end)   filter.date.$lte = parseDateOnlyUtcEnd(end);
        }

        const sortBy = sort === 'title' ? { title: 1 } : { date: 1 };

        const events = await Event.find(filter).sort(sortBy);
        res.json(events);
    } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// ─── OBTENER EVENTO POR ID ─────────────────────────────────────────────────────

/**
 * Devuelve un evento puntual del usuario autenticado por su identificador.
 * @param {Object} req - Solicitud HTTP con `params.id`.
 * @param {Object} res - Respuesta HTTP.
 */
exports.getEvent = async (req, res) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, user_id: req.user._id });
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        res.json(event);
    } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// ─── ACTUALIZAR EVENTO ────────────────────────────────────────────────────────

/**
 * Actualiza campos de un evento y sincroniza el cambio con Google Calendar si
 * existe una conexión activa.
 * @param {Object} req - Solicitud HTTP con `params.id` y campos a modificar.
 * @param {Object} res - Respuesta HTTP.
 */
exports.updateEvent = async (req, res) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, user_id: req.user._id });
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

        const fields = ['title', 'description', 'type', 'date', 'start_time', 'end_time', 'recurrence', 'recurrence_end', 'completed'];
        fields.forEach(f => {
            if (req.body[f] !== undefined) {
                if (f === 'date' || f === 'recurrence_end') {
                    event[f] = req.body[f] ? new Date(req.body[f]) : null;
                } else if (f === 'completed') {
                    event[f] = req.body[f] === true || req.body[f] === 'true';
                } else {
                    event[f] = req.body[f];
                }
            }
        });

        await event.save();

        // Auto-sync update
        try {
            const user = await User.findById(req.user._id);
            const shouldSync = req.body.sync_google === undefined ? true : (req.body.sync_google === true || req.body.sync_google === 'true');
            if (user?.google?.connected && shouldSync) {
                try {
                    const timeZone = req.body.timeZone || 'UTC';
                    if (event.google && event.google.id) {
                        const gid = await googleService.updateEvent(user, event, event.google.id, timeZone);
                        if (gid) { event.google.id = gid; await event.save(); }
                    } else {
                        const gid = await googleService.createEvent(user, event, timeZone);
                        if (gid) { event.google = event.google || {}; event.google.id = gid; await event.save(); }
                    }
                } catch (gErr) {
                    console.error('Google sync update failed:', gErr.message || gErr);
                }
            }
        } catch (errSync) {
            console.error('Error checking Google sync:', errSync.message || errSync);
        }

        res.json({ message: 'Evento actualizado', event });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const msg = Object.values(err.errors).map(e => e.message).join(', ');
            return res.status(400).json({ error: msg });
        }
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// ─── ELIMINAR EVENTO ───────────────────────────────────────────────────────────

/**
 * Elimina un evento del usuario autenticado e intenta borrar también la copia
 * asociada en Google Calendar cuando existe.
 * @param {Object} req - Solicitud HTTP con `params.id`.
 * @param {Object} res - Respuesta HTTP.
 */
exports.deleteEvent = async (req, res) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, user_id: req.user._id });
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

        // Si está sincronizado con Google, intentar eliminar primero en Google
        try {
            const user = await User.findById(req.user._id);
            if (user?.google?.connected && event.google && event.google.id) {
                try {
                    await googleService.deleteEvent(user, event.google.id);
                } catch (gErr) {
                    console.error('Google sync delete failed:', gErr.message || gErr);
                }
            }
        } catch (errSync) {
            console.error('Error checking Google sync before delete:', errSync.message || errSync);
        }

        await event.deleteOne();
        res.json({ message: 'Evento eliminado', event });
    } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// ─── UTILIDAD: EXPANDIR RECURRENCIAS ──────────────────────────────────────────

/**
 * Expande los eventos recurrentes en instancias concretas dentro del rango
 * consultado para que la vista pueda renderizarlos como eventos normales.
 * @param {Array} events - Eventos base obtenidos desde MongoDB.
 * @param {Object} dateFilter - Filtro de fecha aplicado en la consulta.
 * @returns {Array} Lista de eventos expandida y ordenada por fecha.
 */
function expandRecurringEvents(events, dateFilter) {
    const result = [];

    for (const ev of events) {
        if (ev.recurrence === 'none') {
            result.push(ev.toObject());
            continue;
        }

        // Límite superior del rango que pedimos (o 1 año adelante si no hay filtro)
        const rangeEnd = dateFilter?.$lte
            ? new Date(dateFilter.$lte)
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        const recEnd = ev.recurrence_end ? new Date(ev.recurrence_end) : rangeEnd;
        const effectiveEnd = recEnd < rangeEnd ? recEnd : rangeEnd;

        let current = new Date(ev.date);
        const rangeStart = dateFilter?.$gte ? new Date(dateFilter.$gte) : new Date(0);

        while (current <= effectiveEnd) {
            if (current >= rangeStart) {
                result.push({
                    ...ev.toObject(),
                    _id: ev._id,// mismo id base
                    date: new Date(current),
                    _recurrenceInstance: true
                });
            }
            current = nextOccurrence(current, ev.recurrence);
            if (!current) break;
        }
    }

    return result.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function nextOccurrence(date, recurrence) {
    const d = new Date(date);
    switch (recurrence) {
        case 'daily':   d.setDate(d.getDate() + 1); break;
        case 'weekly':  d.setDate(d.getDate() + 7); break;
        case 'monthly': d.setMonth(d.getMonth() + 1); break;
        case 'yearly':  d.setFullYear(d.getFullYear() + 1); break;
        default: return null;
    }
    return d;
}
