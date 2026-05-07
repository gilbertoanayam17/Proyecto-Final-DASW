// ═══════════════════════════════════════════════════════════════════════════════
// SERVIDOR PRINCIPAL - PROYECTO FINAL CALENDARIO
// ═══════════════════════════════════════════════════════════════════════════════
// Archivo: server.js
// Descripción: Archivo principal del servidor backend. Configura Express, middleware,
// rutas, y conexión a MongoDB Atlas. También sirve los archivos estáticos del frontend.
// ═══════════════════════════════════════════════════════════════════════════════

// Cargar variables de entorno desde archivo .env
require('dotenv').config();

// Importar librerías necesarias
const express = require('express'); // Framework web
const path = require('path'); // Utilidades para rutas de archivos
const cors = require('cors'); // Middleware para CORS (Cross-Origin Resource Sharing)
const mongoose = require('mongoose'); // ODM para MongoDB

// Importar rutas y modelos
const apiRouter = require('./routes/api'); // Router principal de la API
const Event = require('./models/event'); // Modelo de eventos

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARES ────────────────────────────────────────────────────────────────
// CORS: Permitir solicitudes desde orígenes diferentes
app.use(cors());

// Middleware para parsear JSON en el cuerpo de las solicitudes
app.use(express.json());

// ─── SERVIR ARCHIVOS ESTÁTICOS DEL FRONTEND ────────────────────────────────────
// Servir archivos del directorio frontend principal
app.use(express.static(path.join(__dirname, '../FRONTEND')));

// Servir archivos HTML de vistas del frontend
app.use(express.static(path.join(__dirname, '../FRONTEND/views')));

// Servir archivos CSS, JS y otros assets del frontend
app.use(express.static(path.join(__dirname, '../FRONTEND/assets')));

// ─── RUTAS API ──────────────────────────────────────────────────────────────────
// Usar el router principal que contiene todas las rutas de la API
app.use(apiRouter);

// ─── CONEXIÓN A MONGODB ATLAS ───────────────────────────────────────────────────
// Conectar a la base de datos MongoDB usando la URI de variables de entorno
mongoose
    .connect(process.env.MONGO_URI)
    .then(async () => {
        // Inicializar campo 'completed' en documentos existentes que no lo tengan
        // Esto es para migración de datos: asegurar que todos los eventos tengan este campo
        await Event.updateMany(
            { completed: { $exists: false } },
            { $set: { completed: false } }
        );
        
        console.log('Conectado a MongoDB Atlas');
        
        // Iniciar servidor en el puerto especificado
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        // Si hay error de conexión, mostrar mensaje de error y terminar proceso
        console.error('Error al conectar a MongoDB Atlas:', err.message);
        process.exit(1);
    });
