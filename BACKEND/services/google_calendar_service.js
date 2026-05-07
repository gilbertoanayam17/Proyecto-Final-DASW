// ═══════════════════════════════════════════════════════════════════════════════
// SERVICIO: GOOGLE CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Maneja la sincronización de eventos con Google Calendar.
// Incluye funciones para crear, actualizar y eliminar eventos en Google.
// ═══════════════════════════════════════════════════════════════════════════════

const { google } = require('googleapis'); // Biblioteca oficial de Google APIs

// ─── FUNCIONES AUXILIARES ───────────────────────────────────────────────────────

/**
 * Obtiene un cliente OAuth2 configurado con credenciales del usuario
 * @param {Object} user - Documento del usuario con credenciales de Google
 * @returns {Object} Cliente OAuth2 autenticado
 */
function getOAuthClientFromUser(user) {
    // Crear nueva instancia del cliente OAuth2 con credenciales de la aplicación
    const oAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
    
    // Si el usuario tiene tokens de Google guardados, usarlos para autenticar
    if (user.google && (user.google.accessToken || user.google.refreshToken)) {
        oAuth2Client.setCredentials({
            access_token: user.google.accessToken,
            refresh_token: user.google.refreshToken,
            // Convertir fecha de expiración a timestamp
            expiry_date: user.google.expiryDate ? new Date(user.google.expiryDate).getTime() : undefined
        });
    }
    return oAuth2Client;
}

/**
 * Mapea los tipos de eventos locales a colores de Google Calendar
 * @param {string} type - Tipo de evento ('evento', 'recordatorio', 'fecha_importante')
 * @returns {string} ID de color de Google Calendar (9=azul, 5=amarillo, 11=rojo)
 */
function mapTypeToColorId(type) {
    // Mapeo: tipo local → ID de color en Google Calendar
    switch (type) {
        case 'recordatorio': return '5';      // Amarillo
        case 'fecha_importante': return '11'; // Rojo
        default: return '9';                  // Azul (evento normal)
    }
}

/**
 * Convierte un Date a string YYYY-MM-DD
 * @param {string|Date} date - Fecha a convertir
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function toDateString(date) {
    // Si es string en formato YYYY-MM-DD, devolver tal cual
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
        return date.split('T')[0];
    }
    
    // Si es objeto Date (del DB, está en UTC), usar métodos UTC
    const d = new Date(date);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// ─── FUNCIONES PRINCIPALES ──────────────────────────────────────────────────────

/**
 * Crea un evento en Google Calendar
 * @param {Object} user - Documento del usuario autenticado
 * @param {Object} ev - Documento del evento a crear
 * @param {string} timeZone - Zona horaria para el evento (ej: 'America/Denver')
 * @returns {string|null} ID del evento creado en Google, o null si hay error
 */
async function createEvent(user, ev, timeZone = 'UTC') {
    // Obtener cliente OAuth2 autenticado con tokens del usuario
    const oAuth2Client = getOAuthClientFromUser(user);
    
    // Crear cliente de Google Calendar API
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    // Mapear el tipo de evento a color en Google Calendar
    const colorId = mapTypeToColorId(ev.type);

    // Construir objeto del evento base con título, descripción y color
    const resource = {
        summary: ev.title,
        description: ev.description || '',
        colorId
    };

    // Configurar horario del evento (con o sin hora específica)
    if (ev.start_time) {
        // Evento con hora específica: convertir a formato datetime
        const startDateTime = `${toDateString(ev.date)}T${ev.start_time}:00`;
        const endDateTime = ev.end_time 
            ? `${toDateString(ev.date)}T${ev.end_time}:00` 
            : null;
        
        resource.start = { dateTime: startDateTime, timeZone };
        
        // Si no hay hora de fin, calcular como 1 hora después de la hora de inicio
        resource.end = { 
            dateTime: endDateTime || new Date(new Date(`${toDateString(ev.date)}T${ev.start_time}:00`).getTime() + 60*60*1000).toISOString(), 
            timeZone 
        };
    } else {
        // Evento de todo el día: usar formato date sin hora
        resource.start = { date: toDateString(ev.date) };
        resource.end = { date: toDateString(ev.date) };
    }

    // Configurar recurrencia si el evento es recurrente
    if (ev.recurrence && ev.recurrence !== 'none') {
        // Mapear recurrencia local a formato RRULE de iCal
        let freq = 'DAILY';
        if (ev.recurrence === 'weekly') freq = 'WEEKLY';
        if (ev.recurrence === 'monthly') freq = 'MONTHLY';
        if (ev.recurrence === 'yearly') freq = 'YEARLY';
        
        // Construir RRULE básico
        let rrule = `RRULE:FREQ=${freq}`;
        
        // Si hay fecha de fin de recurrencia, agregarla
        if (ev.recurrence_end) {
            const d = new Date(ev.recurrence_end);
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            // Incluir hora completa (23:59:59Z) para que sea verdaderamente inclusivo
            const until = `${year}${month}${day}T235959Z`;
            rrule += `;UNTIL=${until}`;
        }
        
        resource.recurrence = [rrule];
    }

    // Enviar solicitud a Google Calendar API para crear el evento
    const resp = await calendar.events.insert({ calendarId: 'primary', resource });
    
    // Retornar ID del evento creado, o null si no hay respuesta
    return resp.data && resp.data.id ? resp.data.id : null;
}

/**
 * Actualiza un evento existente en Google Calendar
 * @param {Object} user - Documento del usuario autenticado
 * @param {Object} ev - Documento del evento a actualizar
 * @param {string} googleEventId - ID del evento en Google Calendar
 * @param {string} timeZone - Zona horaria para el evento
 * @returns {string|null} ID del evento actualizado, o null si hay error
 */
async function updateEvent(user, ev, googleEventId, timeZone = 'UTC') {
    // Si no hay ID de Google, crear el evento como nuevo
    if (!googleEventId) return await createEvent(user, ev, timeZone);
    
    // Obtener cliente OAuth2 autenticado
    const oAuth2Client = getOAuthClientFromUser(user);
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    // Mapear tipo a color
    const colorId = mapTypeToColorId(ev.type);
    
    // Construir objeto del evento actualizado
    const resource = {
        summary: ev.title,
        description: ev.description || '',
        colorId
    };

    // Configurar horario (igual que en createEvent)
    if (ev.start_time) {
        const startDateTime = `${toDateString(ev.date)}T${ev.start_time}:00`;
        const endDateTime = ev.end_time ? `${toDateString(ev.date)}T${ev.end_time}:00` : null;
        resource.start = { dateTime: startDateTime, timeZone };
        resource.end = { dateTime: endDateTime || new Date(new Date(`${toDateString(ev.date)}T${ev.start_time}:00`).getTime() + 60*60*1000).toISOString(), timeZone };
    } else {
        resource.start = { date: toDateString(ev.date) };
        resource.end = { date: toDateString(ev.date) };
    }

    // Configurar recurrencia (igual que en createEvent)
    if (ev.recurrence && ev.recurrence !== 'none') {
        let freq = 'DAILY';
        if (ev.recurrence === 'weekly') freq = 'WEEKLY';
        if (ev.recurrence === 'monthly') freq = 'MONTHLY';
        if (ev.recurrence === 'yearly') freq = 'YEARLY';
        let rrule = `RRULE:FREQ=${freq}`;
        if (ev.recurrence_end) {
            const d = new Date(ev.recurrence_end);
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            // Incluir hora completa (23:59:59Z) para que sea verdaderamente inclusivo
            const until = `${year}${month}${day}T235959Z`;
            rrule += `;UNTIL=${until}`;
        }
        resource.recurrence = [rrule];
    }

    // Enviar solicitud de actualización a Google Calendar API
    const resp = await calendar.events.update({ calendarId: 'primary', eventId: googleEventId, resource });
    
    // Retornar ID del evento actualizado
    return resp.data && resp.data.id ? resp.data.id : null;
}

/**
 * Elimina un evento de Google Calendar
 * @param {Object} user - Documento del usuario autenticado
 * @param {string} googleEventId - ID del evento en Google Calendar a eliminar
 * @returns {boolean} true si se eliminó correctamente, false si hay error
 */
async function deleteEvent(user, googleEventId) {
    // Si no hay ID de Google, no hay nada que eliminar
    if (!googleEventId) return false;
    
    // Obtener cliente OAuth2 autenticado
    const oAuth2Client = getOAuthClientFromUser(user);
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    
    // Enviar solicitud de eliminación a Google Calendar API
    await calendar.events.delete({ calendarId: 'primary', eventId: googleEventId });
    
    // Retornar éxito
    return true;
}

// ─── EXPORTAR FUNCIONES ──────────────────────────────────────────────────────────
module.exports = {
    createEvent,   // Función para crear eventos en Google Calendar
    updateEvent,   // Función para actualizar eventos en Google Calendar
    deleteEvent    // Función para eliminar eventos de Google Calendar
};
