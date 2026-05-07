// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLADOR: TEMA (COLORES Y ESTILOS)
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Gestiona la selección y aplicación de temas de colores globales.
// Se ejecuta en todas las páginas para mantener consistencia de tema.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── PRESETS DE TEMAS ────────────────────────────────────────────────────────────
/**
 * Definición de todos los presets de tema disponibles
 * Cada tema incluye: etiqueta, descripción, y colores muestra (swatches)
 */
const THEME_PRESETS = {
    light: { 
        label: 'Claro', 
        description: 'Clásico, limpio y luminoso', 
        swatch: ['#0284c7', '#06b6d4'] 
    },
    dark: { 
        label: 'Oscuro', 
        description: 'Elegante y de alto contraste', 
        swatch: ['#0ea5e9', '#22d3ee'] 
    },
    neon: { 
        label: 'Neón', 
        description: 'Morado eléctrico con acentos cian', 
        swatch: ['#a855f7', '#22d3ee'] 
    },
    forest: { 
        label: 'Bosque', 
        description: 'Verde profundo y equilibrado', 
        swatch: ['#16a34a', '#84cc16'] 
    },
    sunset: { 
        label: 'Atardecer', 
        description: 'Naranja, coral y violeta', 
        swatch: ['#f97316', '#ec4899'] 
    },
    midnight: { 
        label: 'Medianoche', 
        description: 'Azul noche con acentos fríos', 
        swatch: ['#1d4ed8', '#14b8a6'] 
    }
};

// ─── FUNCIONES AUXILIARES ───────────────────────────────────────────────────────

/**
 * Normaliza un nombre de tema asegurándose que sea válido
 * Si el tema no existe en THEME_PRESETS, retorna 'light' por defecto
 * @param {string} theme - Nombre del tema a normalizar
 * @returns {string} Nombre de tema válido
 */
function normalizeTheme(theme) {
    return Object.prototype.hasOwnProperty.call(THEME_PRESETS, theme) ? theme : 'light';
}

/**
 * Obtiene el tema del usuario desde la sesión
 * @param {Object} user - Datos del usuario (contiene preferencia de tema)
 * @returns {string} Nombre de tema del usuario (normalizado)
 */
function getThemeSession(user) {
    return normalizeTheme(user?.theme || 'light');
}

// ─── INICIALIZACIÓN DEL TEMA ────────────────────────────────────────────────────

/**
 * Inicializa el tema global cuando la página carga
 * Aplica el tema del usuario, configura listeners, e inicializa modal de temas
 */
function initGlobalTheme() {
    // Obtener datos del usuario de la sesión (si existe la función getSession)
    const user = typeof getSession === 'function' ? getSession() : null;
    
    // Si no hay usuario, no hacer nada (probablemente estamos en login)
    if (!user) return;

    // Aplicar el tema del usuario
    applyTheme(getThemeSession(user));

    // Configurar tooltip del botón de tema
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.setAttribute('title', 'Cambiar preset de color');
    }

    // Inicializar modal de selección de tema
    initThemeModal(user);
}

// ─── APLICAR TEMA ───────────────────────────────────────────────────────────────

/**
 * Aplica un tema específico al documento
 * Añade/quita clases CSS y establece atributo data-theme
 * @param {string} theme - Nombre del tema a aplicar
 */
function applyTheme(theme) {
    // Normalizar tema
    const normalizedTheme = normalizeTheme(theme);
    
    // Obtener lista de todas las clases de tema posibles
    const themeClasses = Object.keys(THEME_PRESETS).map(name => `theme-${name}`);

    // Remover todas las clases de tema anteriores y dark-mode
    document.body.classList.remove('dark-mode', ...themeClasses);
    
    // Añadir la clase del tema actual
    document.body.classList.add(`theme-${normalizedTheme}`);

    // Si es tema oscuro, también añadir clase dark-mode
    if (normalizedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }

    // Establecer atributo data-theme en body para referencias CSS
    document.body.dataset.theme = normalizedTheme;
}

/**
 * Actualiza el icono del botón de tema
 * @param {Element} iconElement - Elemento del icono a actualizar
 * @param {string} theme - Nombre del tema (para referencia)
 */
function updateThemeIcon(iconElement, theme) {
    if (!iconElement) return;
    // Establecer icono de paleta (de Bootstrap Icons)
    iconElement.className = 'bi bi-palette-fill fs-5';
}

// ─── MODAL DE SELECCIÓN DE TEMA ──────────────────────────────────────────────────

/**
 * Inicializa el modal de selección de temas y sus manejadores de eventos
 * @param {Object} user - Datos del usuario inicial
 */
function initThemeModal(user) {
    // Obtener elemento modal del tema
    const modalElement = document.getElementById('themePresetModal');
    if (!modalElement) return;

    // Obtener elementos dentro del modal
    const titleElement = modalElement.querySelector('[data-theme-current-label]');  // Etiqueta del tema actual
    const previewElements = modalElement.querySelectorAll('[data-theme-option]');  // Botones de tema

    /**
     * Sincroniza el estado visual del modal con el tema actual
     * Actualiza la etiqueta y el estado activo de los botones
     */
    const syncCurrentState = () => {
        // Obtener tema actual (de sesión actualizada)
        const activeTheme = getThemeSession(typeof getSession === 'function' ? getSession() : user);
        
        // Actualizar etiqueta del tema actual
        if (titleElement) titleElement.textContent = THEME_PRESETS[activeTheme]?.label || THEME_PRESETS.light.label;

        // Actualizar estado visual de los botones de tema
        previewElements.forEach(button => {
            const isActive = button.dataset.themeOption === activeTheme;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    };

    // Sincronizar estado cuando se abre el modal
    modalElement.addEventListener('show.bs.modal', syncCurrentState);
    
    // Sincronizar estado inicial
    syncCurrentState();

    // ─── MANEJADORES DE CLIC EN BOTONES DE TEMA ──────────────────────────────────

    /**
     * Escuchar clic en cada botón de selección de tema
     */
    previewElements.forEach(button => {
        button.addEventListener('click', async () => {
            // Obtener tema seleccionado
            const selectedTheme = normalizeTheme(button.dataset.themeOption);
            
            // Obtener usuario actual de sesión
            const currentUser = typeof getSession === 'function' ? getSession() : user;
            if (!currentUser) return;

            // Aplicar tema localmente primero (UX responsivo)
            applyTheme(selectedTheme);
            
            // Actualizar sesión local con nuevo tema
            setSession({ ...currentUser, theme: selectedTheme });
            
            // Sincronizar interfaz del modal
            syncCurrentState();

            try {
                // Enviar solicitud PATCH al servidor para guardar preferencia de tema
                const res = await fetchWithLoader(`${API_URL}/users/${currentUser._id}`, {
                    method: 'PATCH',
                    headers: authHeaders(),
                    body: JSON.stringify({ theme: selectedTheme })
                });

                // Si la respuesta falla, mostrar error
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.error || 'No se pudo guardar el preset');
                }

                // Parsear respuesta exitosa
                const data = await res.json();
                
                // Actualizar sesión con respuesta del servidor
                setSession({ ...currentUser, theme: data.user.theme });
                
                // Aplicar tema desde servidor
                applyTheme(data.user.theme);
                
                // Sincronizar interfaz del modal
                syncCurrentState();

                // Cerrar modal tras guardar exitosamente
                const modalInstance = bootstrap.Modal.getInstance(modalElement);
                if (modalInstance) modalInstance.hide();
            } catch (err) {
                // Mostrar error en consola
                console.error('Error al guardar preferencia de tema:', err);
                
                // Mostrar alerta al usuario
                alert('No se pudo guardar el preset de color. Intenta de nuevo.');
                
                // Restaurar estado visual anterior
                syncCurrentState();
            }
        });
    });
}

// ─── INICIALIZACIÓN AUTOMÁTICA ──────────────────────────────────────────────────

/**
 * Ejecutar inicialización cuando el DOM esté listo
 * Si el documento ya está cargado, ejecutar inmediatamente
 * Si aún se está cargando, esperar evento DOMContentLoaded
 */
if (document.readyState === 'loading') {
    // Documento aún cargándose
    document.addEventListener('DOMContentLoaded', initGlobalTheme);
} else {
    // Documento ya cargado
    initGlobalTheme();
}
