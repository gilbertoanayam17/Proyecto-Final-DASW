// ═══════════════════════════════════════════════════════════════════════════════
// UTILIDADES: LOADER (ANIMACIÓN DE CARGA)
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Gestiona la visualización del loader/spinner durante llamadas API.
// Usa animación Lottie para una experiencia visual agradable mientras carga.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── MOSTRAR LOADER ─────────────────────────────────────────────────────────────
/**
 * Muestra el modal del loader con animación Lottie
 * El loader se superpone en la pantalla para indicar que hay una operación en progreso
 */
function showLoader() {
    // Obtener elemento modal del loader
    const loaderModal = document.getElementById('loaderModal');
    
    if (loaderModal) {
        // Mostrar el modal con flexbox
        loaderModal.style.display = 'flex';
        
        // Obtener el componente de animación Lottie
        const dotLottie = loaderModal.querySelector('dotlottie-wc');
        
        // Si existe, establecer velocidad de reproducción
        if (dotLottie) {
            dotLottie.speed = 1; // Velocidad normal (1x)
        }
    }
}

// ─── OCULTAR LOADER ────────────────────────────────────────────────────────────
/**
 * Oculta el modal del loader
 * Se llama después de que la petición API termina (exitosa o con error)
 */
function hideLoader() {
    // Obtener elemento modal del loader
    const loaderModal = document.getElementById('loaderModal');
    
    if (loaderModal) {
        // Ocultar el modal
        loaderModal.style.display = 'none';
    }
}

// ─── FETCH CON LOADER ───────────────────────────────────────────────────────────
/**
 * Wrapper para fetch() que maneja automáticamente el loader
 * Asegura una duración mínima de carga para UX consistente
 * @param {string} url - URL a la cual hacer la solicitud
 * @param {Object} options - Opciones de fetch (method, headers, body, etc.)
 * @returns {Promise<Response>} Respuesta de la solicitud fetch
 */
async function fetchWithLoader(url, options = {}) {
    // Mostrar el loader antes de iniciar la solicitud
    showLoader();
    
    // Registrar el tiempo de inicio
    const startTime = Date.now();
    
    try {
        // Realizar la solicitud fetch con las opciones proporcionadas
        const response = await fetch(url, options);
        
        // Calcular tiempo transcurrido
        const elapsed = Date.now() - startTime;
        
        // Si la solicitud fue muy rápida (< 1 segundo),
        // esperar el tiempo restante para que el usuario vea la animación del loader
        // Esto mejora la experiencia visual: si todo es demasiado rápido, no se nota
        if (elapsed < 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
        }
        
        // Retornar la respuesta
        return response;
    } finally {
        // Siempre ocultar el loader, incluso si hay error
        hideLoader();
    }
}
