// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLADOR: AUTENTICACIÓN (FRONTEND)
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Maneja el login y registro de usuarios en el cliente.
// Además, redirige automáticamente si ya hay sesión activa.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── VERIFICACIÓN DE SESIÓN EXISTENTE ────────────────────────────────────────────
// Si el usuario ya está autenticado (hay sesión y token), redirigirlo directo al calendario
(function () {
    // Verificar si existe sesión y token en localStorage
    if (getSession() && getToken()) {
        // Redirigir a la vista de calendario mensual
        window.location.href = 'monthly_view.html';
    }
})();

// ─── EVENTO: FORMULARIO DE LOGIN ──────────────────────────────────────────────────
// Escuchar el envío del formulario de inicio de sesión
document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault(); // Evitar recarga de página
    
    // Obtener valores del formulario
    const email = e.target.email.value.trim();
    const password = e.target.pswd.value;
    const errEl = document.getElementById('loginError'); // Elemento para mostrar errores

    try {
        // Realizar solicitud POST al servidor para autenticar
        const res = await fetchWithLoader(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        // Parsear respuesta JSON
        const data = await res.json();
        
        // Si la respuesta no fue exitosa (status >= 400)
        if (!res.ok) {
            // Mostrar mensaje de error del servidor
            errEl.textContent = data.error || 'Error al iniciar sesión';
            errEl.style.display = 'block';
            return;
        }
        
        // Autenticación exitosa: guardar token y datos del usuario
        setToken(data.token); // Guardar JWT token en localStorage
        setSession(data.user); // Guardar datos del usuario en localStorage
        
        // Redirigir al calendario
        window.location.href = 'monthly_view.html';
    } catch {
        // Error de conexión o red
        errEl.textContent = 'No se pudo conectar al servidor';
        errEl.style.display = 'block';
    }
});

// ─── EVENTO: FORMULARIO DE REGISTRO ──────────────────────────────────────────────
// Escuchar el envío del formulario de registro
document.getElementById('formRegister').addEventListener('submit', async (e) => {
    e.preventDefault(); // Evitar recarga de página
    
    // Obtener valores del formulario
    const name = e.target.nombre.value.trim();
    const email = e.target.email.value.trim();
    const password = e.target.pswd.value;
    const confirm_password = e.target.pswdConfirm.value;
    const errEl = document.getElementById('registerError'); // Elemento para mostrar errores

    // ─── VALIDACIONES DEL LADO DEL CLIENTE ──────────────────────────────────────
    // Validar longitud mínima de contraseña
    if (password.length < 8) {
        errEl.textContent = 'La contraseña debe tener al menos 8 caracteres';
        errEl.style.display = 'block';
        return;
    }
    
    // Validar que las contraseñas coincidan
    if (password !== confirm_password) {
        errEl.textContent = 'Las contraseñas no coinciden';
        errEl.style.display = 'block';
        return;
    }

    try {
        // Realizar solicitud POST al servidor para crear nuevo usuario
        const res = await fetchWithLoader(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, confirm_password })
        });
        
        // Parsear respuesta JSON
        const data = await res.json();
        
        // Si la respuesta no fue exitosa
        if (!res.ok) {
            // Mostrar error del servidor
            errEl.textContent = data.error || 'Error al registrarse';
            errEl.style.display = 'block';
            return;
        }
        
        // Registro exitoso: guardar automáticamente token y usuario (autologin)
        setToken(data.token); // Guardar JWT token en localStorage
        setSession(data.user); // Guardar datos del usuario en localStorage
        
        // Redirigir automáticamente al calendario
        window.location.href = 'monthly_view.html';
    } catch {
        // Error de conexión o red
        errEl.textContent = 'No se pudo conectar al servidor';
        errEl.style.display = 'block';
    }
});
