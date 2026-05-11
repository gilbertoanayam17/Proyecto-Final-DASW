// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLADOR: BÚSQUEDA AVANZADA DE EVENTOS
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Gestiona la página de búsqueda avanzada de eventos.
// Permite buscar por texto, tipo, rango de fechas, y ordenamiento.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ESTADO ──────────────────────────────────────────────────────────────────────

let lastSearchParams = null;

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

    // Inicializar modal de edición de eventos
    initNewEventModal(null);

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
        // Guardar parámetros para re-ejecutar después de editar
    lastSearchParams = params;

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

const TYPE_ICON = {
    'evento': 'bi-calendar-check',
    'recordatorio': 'bi-bell',
    'fecha_importante': 'bi-heart'
};

const RECUR_LABEL = {
    'daily': 'Diaria',
    'weekly': 'Semanal',
    'monthly': 'Mensual',
    'yearly': 'Anual'
};

/**
 * Renderiza los resultados de búsqueda en la página
 * @param {Array} events - Array de eventos encontrados
 */
function renderResults(events) {
    const header = document.getElementById('resultsHeader');
    const body = document.getElementById('resultsBody');

    header.innerHTML = `<i class="bi bi-list-check me-2"></i> Resultados (${events.length})`;

    if (events.length === 0) {
        body.innerHTML = '<p class="text-secondary p-3">No se encontraron eventos.</p>';
        return;
    }

    body.innerHTML = '';

    events.forEach(ev => {
        const key = eventDateKey(ev.date);
        const [y, m, d] = key.split('-').map(Number);
        const dateStr = `${d} de ${MESES[m - 1]}, ${y}`;

        // Hora
        let timeStr;
        if (!ev.start_time) {
            timeStr = 'Todo el día';
        } else {
            timeStr = ev.start_time;
            if (ev.end_time) timeStr += ` – ${ev.end_time}`;
        }

        // Recurrencia
        let recurStr = '';
        if (ev.recurrence && ev.recurrence !== 'none') {
            recurStr = `Se repite: ${RECUR_LABEL[ev.recurrence] || ev.recurrence}`;
            if (ev.recurrence_end) {
                const [ry, rm, rd] = eventDateKey(ev.recurrence_end).split('-').map(Number);
                recurStr += ` hasta ${rd} de ${MESES[rm - 1]}, ${ry}`;
            }
        }

        const iconClass = TYPE_ICON[ev.type] || 'bi-calendar-event';
        const typeClass = ev.type || 'evento';

        const div = document.createElement('div');
        div.className = 'result-item mb-2';
        div.style.cursor = 'pointer';
        div.innerHTML = `
            <div class="result-icon icon-${typeClass}">
                <i class="bi ${iconClass}"></i>
            </div>
            <div class="result-content">
                <h4 class="result-title">${ev.title}</h4>
                <p class="result-meta meta-${typeClass}">${TYPE_LABEL[ev.type] || ev.type}</p>
                <span class="result-date">${dateStr}</span>
                <span class="d-block small text-secondary mt-1"><i class="bi bi-clock me-1"></i>${timeStr}</span>
                ${recurStr ? `<span class="d-block small text-secondary"><i class="bi bi-arrow-repeat me-1"></i>${recurStr}</span>` : ''}
                ${ev.description ? `<p class="result-desc small text-secondary mt-1 mb-0">${ev.description}</p>` : ''}
            </div>`;

        div.addEventListener('click', () => {
            openEditEventModal(ev, {
                onSaved: () => { if (lastSearchParams) doSearch(lastSearchParams); },
                onDeleted: () => { if (lastSearchParams) doSearch(lastSearchParams); }
            });
        });

        body.appendChild(div);
    });
}
