// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLADOR: BÚSQUEDA AVANZADA DE EVENTOS
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Gestiona la página de búsqueda avanzada de eventos.
// Permite buscar por texto, tipo, rango de fechas, y ordenamiento.
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

    // ─── LISTENERS DE BÚSQUEDA ──────────────────────────────────────────────────
    
    // Botón "Buscar por Rango": búsqueda por rango de fechas
    document.getElementById('btnSearchRange').addEventListener('click', searchByRange);
    
    // Botón "Buscar por Texto": búsqueda de texto en título/descripción
    document.getElementById('btnSearchText').addEventListener('click', searchByText);
    
    // Botón "Hoy": buscar eventos de hoy
    document.getElementById('btnSearchToday').addEventListener('click', searchToday);

    // Tecla Enter en campo de búsqueda: también ejecutar búsqueda de texto
    document.getElementById('searchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchByText();
    });
}

// ─── FUNCIONES DE BÚSQUEDA ──────────────────────────────────────────────────────

/**
 * Busca eventos de hoy
 */
async function searchToday() {
    // Obtener fecha de hoy en formato YYYY-MM-DD
    const today = toISO(new Date());
    
    // Ejecutar búsqueda con rango de hoy a hoy
    await doSearch({ start: today, end: today });
}

/**
 * Busca eventos en un rango de fechas
 */
async function searchByRange() {
    // Obtener fechas del formulario
    const start = document.getElementById('searchDateStart').value;
    const end = document.getElementById('searchDateEnd').value;
    
    // Validar que ambas fechas estén ingresadas
    if (!start || !end) { 
        alert('Selecciona ambas fechas'); 
        return; 
    }
    
    // Ejecutar búsqueda con el rango especificado
    await doSearch({ start, end });
}

/**
 * Busca eventos por texto en título/descripción
 */
async function searchByText() {
    // Obtener texto de búsqueda
    const q = document.getElementById('searchInput').value.trim();
    
    // Obtener tipo de evento seleccionado
    const typeEl = document.getElementById('searchType');
    
    // Obtener criterio de ordenamiento
    const sortEl = document.getElementById('searchSort');
    
    // Extraer valores (evitar enviar "todos" como tipo)
    const type = typeEl.value !== 'todos' ? typeEl.value : '';
    
    // Convertir criterio de ordenamiento (titulo → title)
    const sort = sortEl.value === 'titulo' ? 'title' : 'date';
    
    // Ejecutar búsqueda
    await doSearch({ q, type, sort });
}

/**
 * Función central que ejecuta la búsqueda en el servidor
 * @param {Object} params - Parámetros de búsqueda (q, type, start, end, sort)
 */
async function doSearch(params) {
    // Construir query string con parámetros
    const qs = new URLSearchParams();
    
    if (params.q) qs.set('q', params.q);
    if (params.type) qs.set('type', params.type);
    if (params.start) qs.set('start', params.start);
    if (params.end) qs.set('end', params.end);
    if (params.sort) qs.set('sort', params.sort);

    // Obtener elementos de resultado
    const resultsHeader = document.getElementById('resultsHeader');
    const resultsBody = document.getElementById('resultsBody');
    
    // Mostrar estado de carga
    resultsHeader.textContent = 'Buscando...';
    resultsBody.innerHTML = '<p class="text-secondary p-3">Cargando...</p>';

    try {
        // Realizar solicitud GET al servidor
        const res = await fetchWithLoader(`${API_URL}/events/search?${qs}`, {
            headers: authHeaders()
        });
        
        // Parsear respuesta
        const data = res.ok ? await res.json() : [];
        
        // Renderizar resultados
        renderResults(data);
    } catch {
        // Mostrar error de conexión
        resultsBody.innerHTML = '<p class="text-danger p-3">Error de conexión</p>';
    }
}

// ─── RENDERIZACIÓN DE RESULTADOS ────────────────────────────────────────────────

/**
 * Renderiza los resultados de búsqueda en la página
 * @param {Array} events - Array de eventos encontrados
 */
function renderResults(events) {
    // Obtener elementos de resultado
    const header = document.getElementById('resultsHeader');
    const body = document.getElementById('resultsBody');
    
    // Actualizar header con cantidad de resultados
    header.textContent = `Resultados (${events.length})`;

    // Si no hay resultados, mostrar mensaje
    if (events.length === 0) {
        body.innerHTML = '<p class="text-secondary p-3">No se encontraron eventos.</p>';
        return;
    }

    // Limpiar cuerpo de resultados
    body.innerHTML = '';
    
    // Iterar sobre cada evento encontrado
    events.forEach(ev => {
        // Obtener clave de fecha (YYYY-MM-DD)
        const key = eventDateKey(ev.date);
        
        // Parsear fecha en partes
        const [y, m, d] = key.split('-').map(Number);
        
        // Formatear fecha legible
        const dateStr = `${d} de ${MESES[m - 1]}, ${y}`;
        
        // Crear elemento div para resultado
        const div = document.createElement('div');
        div.className = 'result-item';
        div.innerHTML = `
            <div class="result-icon">
                <i class="bi bi-calendar-event"></i>
            </div>
            <div class="result-content">
                <h4 class="result-title">${ev.title}</h4>
                <p class="result-meta">${TYPE_LABEL[ev.type] || ev.type}</p>
                <span class="result-date">${dateStr}</span>
                ${ev.description ? `<p class="result-desc small text-secondary mt-1">${ev.description}</p>` : ''}
            </div>`;
        
        // Agregar resultado al cuerpo
        body.appendChild(div);
    });
}
