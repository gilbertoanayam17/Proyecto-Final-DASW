// ═══════════════════════════════════════════════════════════════════════════════
// MODELO: USER (USUARIO)
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Define la estructura de un usuario en la base de datos.
// Incluye: datos de autenticación, preferencias de tema, e info de Google Calendar
// ═══════════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

// Definir esquema del usuario en MongoDB
const userSchema = new mongoose.Schema(
    {
        // Nombre completo del usuario (campo requerido)
        name: {
            type: String,
            required: [true, 'El nombre es obligatorio'],
            trim: true
        },
        
        // Email del usuario (único, requerido, con validación de formato)
        email: {
            type: String,
            required: [true, 'El email es obligatorio'],
            unique: true, // No puede haber dos usuarios con el mismo email
            trim: true,
            lowercase: true, // Guardar en minúsculas para consistencia
            // Validación: asegurar que sea un email válido (formato básico)
            match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Formato de email inválido']
        },
        
        // Contraseña hasheada del usuario (requerida, mínimo 8 caracteres)
        password: {
            type: String,
            required: [true, 'La contraseña es obligatoria'],
            minlength: [8, 'La contraseña debe tener al menos 8 caracteres']
        },
        
        // Tema preferido del usuario
        // Opciones: 'light' (claro), 'dark' (oscuro), 'neon', 'forest', 'sunset', 'midnight'
        theme: {
            type: String,
            enum: ['light', 'dark', 'neon', 'forest', 'sunset', 'midnight'],
            default: 'light'
        },
        
        // Información de conexión con Google Calendar
        google: {
            // Indicador si el usuario ha conectado su cuenta de Google
            connected: { type: Boolean, default: false },
            
            // Token de acceso a Google Calendar (se obtiene en el callback de OAuth)
            accessToken: { type: String, default: null },
            
            // Token de refresco para obtener nuevos accessTokens sin reautenticación
            refreshToken: { type: String, default: null },
            
            // Ámbitos (scopes) de permisos otorgados por Google
            scope: { type: String, default: null },
            
            // Fecha de expiración del accessToken
            expiryDate: { type: Date, default: null }
        }
    },
    {
        // Configuración de timestamps personalizados
        // createdAt se renombra a 'joined_at' (fecha de registro)
        // updatedAt no se incluye (false)
        timestamps: { createdAt: 'joined_at', updatedAt: false }
    }
);

// Exportar el modelo User
module.exports = mongoose.model('User', userSchema);
