// ═══════════════════════════════════════════════════════════════════════════════
// MODELO: EVENT (EVENTO)
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Define la estructura de un evento/recordatorio en la base de datos.
// Incluye campos para: título, descripción, tipo, fecha, hora, recurrencia, etc.
// ═══════════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

// Definir esquema del evento en MongoDB
const eventSchema = new mongoose.Schema(
    {
        // Título del evento (campo requerido)
        title: {
            type: String,
            required: [true, 'El título es obligatorio'],
            trim: true
        },
        
        // Descripción del evento (opcional)
        description: {
            type: String,
            trim: true,
            default: ''
        },
        
        // Tipo de evento: puede ser 'evento', 'recordatorio', 'fecha_importante'
        // 'evento': evento normal del calendario
        // 'recordatorio': recordatorio de algo importante
        // 'fecha_importante': una fecha relevante a recordar
        type: {
            type: String,
            enum: ['evento', 'recordatorio', 'fecha_importante'],
            default: 'evento'
        },
        
        // Fecha del evento (campo requerido)
        date: {
            type: Date,
            required: [true, 'La fecha es obligatoria']
        },
        
        // Hora de inicio en formato "HH:MM" (ej: "14:30")
        start_time: {
            type: String,   // Formato: "HH:MM"
            default: null
        },
        
        // Hora de finalización en formato "HH:MM"
        end_time: {
            type: String,   // Formato: "HH:MM"
            default: null
        },
        
        // Configuración de recurrencia del evento
        // 'none': evento sin recurrencia (única ocasión)
        // 'daily': se repite todos los días
        // 'weekly': se repite cada semana
        // 'monthly': se repite cada mes
        // 'yearly': se repite cada año
        recurrence: {
            type: String,
            enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
            default: 'none'
        },
        
        // Fecha de fin de la recurrencia
        // Si se especifica, el evento recurrente dejará de repetirse en esta fecha
        recurrence_end: {
            type: Date,
            default: null
        },
        
        // Estado de completado del evento
        // true: evento marcado como completado
        // false: evento pendiente o no completado
        completed: {
            type: Boolean,
            default: false
        },
        
        // Referencia al usuario propietario del evento (clave foránea)
        // Vincula este evento con un documento de Usuario específico
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        
        // Información de sincronización con Google Calendar
        google: {
            // ID del evento en Google Calendar (para identificar el evento sincronizado)
            id: { type: String, default: null }
        }
    },
    {
        // Agregar campos automáticos: createdAt y updatedAt
        // Rastrean cuándo se creó y modificó el evento
        timestamps: true
    }
);

// ─── ÍNDICES PARA BÚSQUEDAS EFICIENTES ──────────────────────────────────────────
// Índice compuesto: buscar eventos rápidamente por usuario e inserción por fecha
eventSchema.index({ user_id: 1, date: 1 });

// Índice compuesto: filtrar eventos por usuario y tipo
eventSchema.index({ user_id: 1, type: 1 });

// Exportar el modelo Event
module.exports = mongoose.model('Event', eventSchema);
