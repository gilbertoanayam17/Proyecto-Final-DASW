// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLADOR: PERFIL DE USUARIO
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Gestiona la página de perfil del usuario.
// Permite actualizar nombre, email, contraseña, ver estadísticas y eliminar cuenta.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── INICIALIZACIÓN ──────────────────────────────────────────────────────────────

// Verificar que el usuario esté autenticado
const user = requireAuth();

// Si el usuario está autenticado, inicializar la página
if (user) {
    // Actualizar nombre de usuario en la navegación
    updateNavUser(user);
    
    // Actualizar fecha de hoy en el sidebar
    updateSidebarDate();
    
    // Inicializar funcionalidad de logout
    initLogout();
    
    // Cargar datos del perfil en el formulario
    loadProfile();
    
    // Cargar estadísticas del usuario
    loadStats();

    // ─── EVENTO: FORMULARIO DE ACTUALIZACIÓN DE PERFIL ──────────────────────────
    // Escuchar envío del formulario de actualización
    document.getElementById('formProfile').addEventListener('submit', async (e) => {
        e.preventDefault(); // Evitar recarga de página
        
        // Obtener valores actuales del formulario
        const name = document.getElementById('profileName').value.trim();
        const email = document.getElementById('profileEmail').value.trim();
        const current_password = document.getElementById('profileCurrentPwd').value;
        const new_password = document.getElementById('profileNewPwd').value;
        const confirm_new_password = document.getElementById('profileConfirmPwd').value;

        // Construir payload solo con campos modificados
        const payload = {};
        
        // Incluir nombre solo si cambió
        if (name && name !== user.name) payload.name = name;
        
        // Incluir email solo si cambió
        if (email && email !== user.email) payload.email = email;
        
        // Incluir datos de contraseña si se proporcionó nueva contraseña
        if (new_password) {
            payload.current_password = current_password;
            payload.new_password = new_password;
            payload.confirm_new_password = confirm_new_password;
        }

        // Si no hay cambios, mostrar advertencia
        if (Object.keys(payload).length === 0) {
            showMsg('No hay cambios para guardar', 'warning');
            return;
        }

        try {
            // Enviar solicitud PATCH para actualizar perfil
            const res = await fetchWithLoader(`${API_URL}/users/${user._id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(payload)
            });
            
            // Parsear respuesta
            const data = await res.json();

            // Actualizar sesión local con nuevos datos
            const updated = { ...user, name: data.user.name, email: data.user.email };
            setSession(updated);
            updateNavUser(updated);
            
            // Actualizar nombre de usuario en todos lados
            document.querySelectorAll('.nav-user-name').forEach(el => el.textContent = updated.name);
            
            // Limpiar campos de contraseña (por seguridad)
            document.getElementById('profileCurrentPwd').value = '';
            document.getElementById('profileNewPwd').value = '';
            document.getElementById('profileConfirmPwd').value = '';
            
            // Mostrar mensaje de éxito
            showMsg('¡Cambios guardados exitosamente!', 'success');
        } catch {
            // Mostrar error de conexión
            showMsg('Diste mal tu contraseña actual o la nueva contraseña no cumple con los requisitos o la confirmación no coincide', 'danger');
        }
    });

    // ─── EVENTO: BOTÓN ELIMINAR CUENTA ──────────────────────────────────────────
    // Escuchar clic en botón de confirmación de eliminación
    document.getElementById('btnDeleteConfirm').addEventListener('click', async () => {
        // Obtener contraseñas ingresadas
        const pwd = document.getElementById('deleteAccountPassword').value;
        const confirm = document.getElementById('deleteAccountPasswordConfirm').value;

        // Validar que se ingresó contraseña
        if (!pwd) { 
            alert('Ingresa tu contraseña'); 
            return; 
        }
        
        // Validar que ambas contraseñas coincidan
        if (pwd !== confirm) { 
            alert('Las contraseñas no coinciden'); 
            return; 
        }

        // Verificar contraseña haciendo login (validación de seguridad)
        try {
            // Intentar login con email y contraseña ingresada
            const loginRes = await fetchWithLoader(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, password: pwd })
            });
            
            // Si el login falla, la contraseña es incorrecta
            if (!loginRes.ok) { 
                alert('Contraseña incorrecta'); 
                return; 
            }

            // Proceder a eliminar la cuenta
            const res = await fetchWithLoader(`${API_URL}/users/${user._id}`, {
                method: 'DELETE',
                headers: authHeaders()
            });
            
            // Si hay error, mostrar alerta
            if (!res.ok) { 
                alert('Error al eliminar cuenta'); 
                return; 
            }

            // Cuenta eliminada exitosamente: limpiar sesión y redirigir
            clearSession();
            window.location.href = 'login.html';
        } catch {
            // Error de conexión
            alert('Error de conexión');
        }
    });
}

// ─── FUNCIONES AUXILIARES ───────────────────────────────────────────────────────

/**
 * Carga los datos del usuario en el formulario de perfil
 */
function loadProfile() {
    // Llenar campo de nombre
    document.getElementById('profileName').value = user.name;
    
    // Llenar campo de email
    document.getElementById('profileEmail').value = user.email;
}

/**
 * Carga las estadísticas del usuario desde el servidor
 * Muestra conteos de eventos, recordatorios y fechas importantes
 */
async function loadStats() {
    try {
        // Solicitar estadísticas del usuario
        const res = await fetchWithLoader(`${API_URL}/users/${user._id}/stats`, {
            headers: authHeaders()
        });
        
        // Si la solicitud falla, no hacer nada
        if (!res.ok) return;
        
        // Parsear respuesta
        const { eventos, recordatorios, fechas_importantes } = await res.json();
        
        // Actualizar elementos HTML con estadísticas
        document.getElementById('statEventos').textContent = eventos;
        document.getElementById('statRecordatorios').textContent = recordatorios;
        document.getElementById('statFechas').textContent = fechas_importantes;
    } catch { 
        // Error silencioso - las estadísticas son opcionales
    }
}

/**
 * Muestra un mensaje al usuario con alert styling
 * @param {string} msg - Mensaje a mostrar
 * @param {string} type - Tipo de alerta ('success', 'warning', 'danger', etc.)
 */
function showMsg(msg, type) {
    // Obtener elemento de mensaje
    const el = document.getElementById('profileMsg');
    
    // Establecer clase según tipo de mensaje
    el.className = `alert alert-${type} mt-3`;
    
    // Establecer texto del mensaje
    el.textContent = msg;
    
    // Mostrar elemento
    el.style.display = 'block';
    
    // Ocultar automáticamente después de 4 segundos
    setTimeout(() => { 
        el.style.display = 'none'; 
    }, 4000);
}
