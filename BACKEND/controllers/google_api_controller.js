const { google } = require('googleapis');
const User = require('../models/user');

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLADOR: OAUTH DE GOOGLE CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Gestiona la conexión OAuth 2.0 con Google Calendar y almacena
// los tokens necesarios para sincronizar eventos del usuario.
// ═══════════════════════════════════════════════════════════════════════════════

// Scope mínimo para crear y actualizar eventos en Calendar.
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

/**
 * Construye un cliente OAuth2 con las credenciales de la aplicación.
 * @returns {Object} Cliente OAuth2 de Google.
 */
function getOAuthClient() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
}

/**
 * Genera la URL de autorización de Google para el usuario autenticado.
 * @param {Object} req - Solicitud HTTP con `req.user` cargado por middleware.
 * @param {Object} res - Respuesta HTTP.
 */
exports.getAuthUrl = async (req, res) => {
    try {
        const userId = req.user && req.user._id ? String(req.user._id) : null;
        const oAuth2Client = getOAuthClient();
        const url = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: SCOPES,
            state: userId || ''
        });
        res.json({ url });
    } catch (err) {
        res.status(500).json({ error: 'No se pudo generar URL de autorización' });
    }
};

/**
 * Procesa el callback OAuth de Google, intercambia el código por tokens y
 * guarda la conexión en el usuario correspondiente.
 * @param {Object} req - Solicitud HTTP con `query.code` y `query.state`.
 * @param {Object} res - Respuesta HTTP.
 */
exports.handleCallback = async (req, res) => {
    try {
        const code = req.query.code;
        const state = req.query.state; // userId enviado en la autorización
        if (!code || !state) return res.status(400).send('Falta código o estado');

        const oAuth2Client = getOAuthClient();
        const { tokens } = await oAuth2Client.getToken(code);

        // Guardar tokens en el usuario y marcar la cuenta como conectada
        const user = await User.findById(state);
        if (!user) return res.status(404).send('Usuario no encontrado');

        user.google = user.google || {};
        user.google.connected = true;
        user.google.accessToken = tokens.access_token || null;
        user.google.refreshToken = tokens.refresh_token || user.google.refreshToken || null;
        user.google.scope = tokens.scope || user.google.scope || null;
        user.google.expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

        await user.save();

        // Mostrar una confirmación simple para que el usuario pueda cerrar la ventana
        res.send('<html><body><h3>Conexión con Google Calendar exitosa. Puedes cerrar esta ventana.</h3></body></html>');
    } catch (err) {
        console.error('Google callback error:', err);
        res.status(500).send('Error al procesar la respuesta de Google');
    }
};
