const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Event = require('../models/event');

const JWT_SECRET = process.env.JWT_SECRET;

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLADOR: API DE USUARIOS Y AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Maneja login, registro, lectura, actualización y eliminación de
// usuarios, además de dos middlewares de autenticación para rutas protegidas.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── MIDDLEWARE: RUTAS /users/:id ──────────────────────────────────────────────

/**
 * Valida el JWT de rutas de usuario y confirma que el token pertenezca al `id`
 * solicitado en la URL.
 * @param {Object} req - Solicitud HTTP.
 * @param {Object} res - Respuesta HTTP.
 * @param {Function} next - Siguiente middleware.
 */
exports.authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No autorizado' });
        
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const paramId = req.params.id;
        if (decoded.userId !== paramId) return res.status(401).json({ error: 'No autorizado' });
        
        const user = await User.findById(decoded.userId);
        if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
        
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};

// ─── MIDDLEWARE: RUTAS GENERALES PROTEGIDAS ───────────────────────────────────

/**
 * Valida el JWT para rutas protegidas que solo necesitan saber qué usuario está
 * autenticado, sin comparar contra un `params.id` específico.
 * @param {Object} req - Solicitud HTTP.
 * @param {Object} res - Respuesta HTTP.
 * @param {Function} next - Siguiente middleware.
 */
exports.authGenericMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No autorizado. Inicia sesión primero.' });
        
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const user = await User.findById(decoded.userId);
        if (!user) return res.status(401).json({ error: 'Cuenta no encontrada. Verifica tu sesión.' });
        
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};

// ─── INICIO DE SESIÓN ──────────────────────────────────────────────────────────

/**
 * Autentica credenciales y devuelve un JWT junto con los datos básicos del usuario.
 * @param {Object} req - Solicitud HTTP con `email` y `password` en `body`.
 * @param {Object} res - Respuesta HTTP.
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Credenciales incorrectas' });

        // Genera el JWT token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ 
            token,
            user: { _id: user._id, name: user.name, email: user.email, theme: user.theme, joined_at: user.joined_at }
        });
    } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// ─── REGISTRO DE USUARIO ──────────────────────────────────────────────────────

/**
 * Crea un usuario nuevo, valida la contraseña y devuelve un JWT de sesión.
 * @param {Object} req - Solicitud HTTP con datos del registro en `body`.
 * @param {Object} res - Respuesta HTTP.
 */
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password, confirm_password } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
        if (!confirm_password || password !== confirm_password)
            return res.status(400).json({ error: 'Las contraseñas no coinciden' });
        if (password.length < 8)
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

        const exists = await User.findOne({ email: email.toLowerCase() });
        if (exists) return res.status(400).json({ error: 'El email ya está registrado' });

        const hashed = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashed });
        await user.save();

        // Genera el JWT token después del registro
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            message: 'Usuario creado exitosamente',
            token,
            user: { _id: user._id, name: user.name, email: user.email, theme: user.theme, joined_at: user.joined_at }
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: Object.values(err.errors).map(e => e.message).join(', ') });
        }
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// ─── OBTENER PERFIL DE USUARIO ────────────────────────────────────────────────

/**
 * Devuelve la información pública del usuario autenticado.
 * @param {Object} req - Solicitud HTTP.
 * @param {Object} res - Respuesta HTTP.
 */
exports.getUser = async (req, res) => {
    const u = req.user;
    res.json({ _id: u._id, name: u.name, email: u.email, theme: u.theme, joined_at: u.joined_at });
};

// ─── ACTUALIZAR USUARIO ───────────────────────────────────────────────────────

/**
 * Actualiza nombre, email, contraseña o tema del usuario autenticado.
 * @param {Object} req - Solicitud HTTP con campos editables en `body`.
 * @param {Object} res - Respuesta HTTP.
 */
exports.updateUser = async (req, res) => {
    try {
        const { name, email, current_password, new_password, confirm_new_password, theme } = req.body;
        const user = req.user;
        const allowedThemes = ['light', 'dark', 'neon', 'forest', 'sunset', 'midnight'];

        if (!name && !email && !new_password && !theme)
            return res.status(400).json({ error: 'Debes enviar al menos un campo a actualizar' });

        if (name) user.name = name.trim();

        if (email) {
            const taken = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
            if (taken) return res.status(400).json({ error: 'El email ya está en uso' });
            user.email = email.toLowerCase().trim();
        }

        if (new_password) {
            if (!current_password)
                return res.status(400).json({ error: 'Debes ingresar tu contraseña actual' });
            const match = await bcrypt.compare(current_password, user.password);
            if (!match) return res.status(400).json({ error: 'Contraseña actual incorrecta' });
            if (new_password !== confirm_new_password)
                return res.status(400).json({ error: 'Las contraseñas nuevas no coinciden' });
            if (new_password.length < 8)
                return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
            user.password = await bcrypt.hash(new_password, 10);
        }

        if (theme && allowedThemes.includes(theme)) {
            user.theme = theme;
        }

        await user.save();
        res.json({ message: 'Usuario actualizado', user: { _id: user._id, name: user.name, email: user.email, theme: user.theme } });
    } catch (err) {
        if (err.name === 'ValidationError')
            return res.status(400).json({ error: Object.values(err.errors).map(e => e.message).join(', ') });
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// ─── ELIMINAR USUARIO ─────────────────────────────────────────────────────────

/**
 * Elimina la cuenta del usuario y todos sus eventos asociados.
 * @param {Object} req - Solicitud HTTP.
 * @param {Object} res - Respuesta HTTP.
 */
exports.deleteUser = async (req, res) => {
    try {
        await Event.deleteMany({ user_id: req.user._id });
        await User.findByIdAndDelete(req.user._id);
        res.json({ message: 'Cuenta eliminada exitosamente' });
    } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// ─── ESTADÍSTICAS DE USUARIO ──────────────────────────────────────────────────

/**
 * Devuelve conteos agregados de eventos por tipo para el usuario autenticado.
 * @param {Object} req - Solicitud HTTP.
 * @param {Object} res - Respuesta HTTP.
 */
exports.getUserStats = async (req, res) => {
    try {
        const uid = req.user._id;
        const [eventos, recordatorios, fechas_importantes] = await Promise.all([
            Event.countDocuments({ user_id: uid, type: 'evento' }),
            Event.countDocuments({ user_id: uid, type: 'recordatorio' }),
            Event.countDocuments({ user_id: uid, type: 'fecha_importante' })
        ]);
        res.json({ eventos, recordatorios, fechas_importantes });
    } catch {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
