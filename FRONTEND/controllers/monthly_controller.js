// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLADOR: VISTA MENSUAL DEL CALENDARIO
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Gestiona la vista del calendario por mes con grid de 7x5/6 días.
// Incluye: filtrado, drag & drop, edición, eliminación de eventos.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ESTADO GLOBAL ──────────────────────────────────────────────────────────────

// Mes actual que se está visualizando
let currentMonth = new Date();
currentMonth.setDate(1);

// Filtros activos (Set vacío = mostrar todos)
const activeFilters = new Set();

// Array de eventos del mes actual
let monthEvents = [];

// ─── INICIALIZACIÓN ─────────────────────────────────────────────────────────────

// Verificar que el usuario esté autenticado
const user = requireAuth();

// Si el usuario está autenticado, inicializar la página
if (user) {
    // Actualizar nombre de usuario en navegación
    updateNavUser(user);
    
    // Actualizar fecha de hoy en sidebar
    updateSidebarDate();
    
    // Inicializar funcionalidad de logout
    initLogout();
    
    // Inicializar modal de creación de eventos
    initNewEventModal(() => fetchAndRender());

    // Establecer fecha por defecto en el input del modal al día de hoy
    document.getElementById('eventDate').value = toISO(new Date());

    // ─── LISTENERS DE FILTROS ───────────────────────────────────────────────────

    document.getElementById('filterEvents').addEventListener('click', (e) => {
        e.preventDefault();
        toggleFilter('evento');
    });

    document.getElementById('filterReminders').addEventListener('click', (e) => {
        e.preventDefault();
        toggleFilter('recordatorio');
    });

    document.getElementById('filterImportant').addEventListener('click', (e) => {
        e.preventDefault();
        toggleFilter('fecha_importante');
    });

    // ─── NAVEGACIÓN DE MES ──────────────────────────────────────────────────────
    
    // Botón: ir al mes anterior
    document.getElementById('btnPrevMonth').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        fetchAndRender();
    });
    
    // Botón: ir al mes siguiente
    document.getElementById('btnNextMonth').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        fetchAndRender();
    });

    // Cargar y renderizar eventos del mes actual
    fetchAndRender();
}

// ─── FUNCIONES DE FILTRADO ──────────────────────────────────────────────────────

/**
 * Activa/desactiva un filtro y re-renderiza el calendario
 * @param {string} f - Tipo a alternar ('evento', 'recordatorio', 'fecha_importante')
 */
function toggleFilter(f) {
    if (activeFilters.has(f)) {
        activeFilters.delete(f);
    } else {
        activeFilters.add(f);
    }

    document.getElementById('filterEvents').classList.toggle('active-cyan', activeFilters.has('evento'));
    document.getElementById('filterReminders').classList.toggle('active-cyan', activeFilters.has('recordatorio'));
    document.getElementById('filterImportant').classList.toggle('active-cyan', activeFilters.has('fecha_importante'));

    const subtitleEl = document.getElementById('subtitleText');
    if (subtitleEl) {
        subtitleEl.textContent = activeFilters.size === 0 ? 'Mostrando todos los eventos' :
            [...activeFilters].map(t =>
                t === 'evento' ? 'Eventos' :
                t === 'recordatorio' ? 'Recordatorios' :
                'Fechas Importantes'
            ).join(' + ');
    }

    renderCalendar(monthEvents);
}

// ─── CARGA Y RENDERIZACIÓN ──────────────────────────────────────────────────────

/**
 * Obtiene eventos del servidor y renderiza el calendario
 */
async function fetchAndRender() {
    // Obtener año y mes actual
    const y = currentMonth.getFullYear();
    const m = String(currentMonth.getMonth() + 1).padStart(2, '0');
    
    // Actualizar título con mes y año
    document.getElementById('calendarTitle').textContent = `${MESES[currentMonth.getMonth()]} ${y}`;

    try {
        // Solicitar eventos del mes al servidor
        const res = await fetchWithLoader(`${API_URL}/events?month=${y}-${m}`, {
            headers: authHeaders()
        });
        
        // Si hay error, registrar y retornar
        if (!res.ok) { 
            console.error('Error fetching events'); 
            return; 
        }
        
        // Parsear eventos
        monthEvents = await res.json();
    } catch (e) {
        // Error de conexión
        console.error(e);
        monthEvents = [];
    }
    
    // Renderizar calendario con eventos obtenidos
    renderCalendar(monthEvents);
}

/**
 * Renderiza el grid del calendario con eventos
 * @param {Array} events - Array de eventos a mostrar
 */
function renderCalendar(events) {
    // Obtener contenedor del grid
    const grid = document.getElementById('calendarDays');
    grid.innerHTML = '';

    const today = new Date();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // Obtener primer y último día del mes
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Filtrar eventos según filtros activos (vacío = mostrar todos)
    const filtered = activeFilters.size === 0 ? events : events.filter(e => activeFilters.has(e.type));

    // Agrupar eventos por fecha usando UTC para evitar desfase de zona horaria
    const byDate = {};
    filtered.forEach(ev => {
        const key = eventDateKey(ev.date);
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(ev);
    });

    // ─── RELLENAR DÍAS DEL MES ANTERIOR ─────────────────────────────────────────
    // La semana comienza en domingo (0)
    const startPad = firstDay.getDay(); // 0=Dom
    for (let i = startPad - 1; i >= 0; i--) {
        const d = new Date(year, month, -i);
        grid.appendChild(makeCell(d, true, byDate)); // true = día atenuado
    }

    // ─── RELLENAR DÍAS DEL MES ACTUAL ───────────────────────────────────────────
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const date = new Date(year, month, d);
        grid.appendChild(makeCell(date, false, byDate)); // false = día normal
    }

    // ─── RELLENAR DÍAS DEL MES SIGUIENTE ────────────────────────────────────────
    // Completar hasta múltiplo de 7 (semanas completas)
    const total = startPad + lastDay.getDate();
    const endPad = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let d = 1; d <= endPad; d++) {
        const date = new Date(year, month + 1, d);
        grid.appendChild(makeCell(date, true, byDate)); // true = día atenuado
    }

    // ─── AJUSTAR ALTURA DEL GRID ────────────────────────────────────────────────
    // Calcular número de semanas para distribuir el espacio equitativamente
    const totalCells = startPad + lastDay.getDate() + endPad;
    const numWeeks = totalCells / 7;
    grid.style.gridTemplateRows = `repeat(${numWeeks}, 1fr)`;
}

// ─── CREACIÓN DE CELDAS DEL CALENDARIO ───────────────────────────────────────

/**
 * Crea una celda (día) del calendario
 * @param {Date} date - Fecha del día
 * @param {boolean} muted - Si es true, el día se muestra atenuado (otro mes)
 * @param {Object} byDate - Objeto con eventos agrupados por fecha
 * @returns {Element} Elemento DOM de la celda
 */
function makeCell(date, muted, byDate) {
    // Crear elemento div para la celda
    const cell = document.createElement('div');
    cell.className = 'calendar-cell' + (muted ? ' muted-day' : '');
    cell.dataset.date = toISO(date);

    // Verificar si es hoy
    const today = new Date();
    const isToday = toISO(date) === toISO(today);

    // ─── NÚMERO DEL DÍA ─────────────────────────────────────────────────────────
    
    const dayEl = document.createElement('div');
    if (isToday) {
        // Si es hoy, mostrar con badge especial
        dayEl.innerHTML = `<div class="current-day-badge shadow">${date.getDate()}</div>`;
    } else {
        // Si no, mostrar número simple
        dayEl.textContent = date.getDate();
    }
    cell.appendChild(dayEl);

    // ─── EVENTOS DEL DÍA ────────────────────────────────────────────────────────
    
    const key = toISO(date);
    if (byDate[key]) {
        // Añadir cada evento del día a la celda
        byDate[key].forEach(ev => {
            cell.appendChild(makeEventChip(ev));
        });
    }

    // ─── DRAG & DROP ────────────────────────────────────────────────────────────
    
    // Permitir drag over
    cell.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        cell.classList.add('drag-over'); 
    });
    
    // Remover clase al salir
    cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
    
    // Manejar drop de evento
    cell.addEventListener('drop', handleDrop);

    // ─── CREAR EVENTO EN CELDA VACÍA ────────────────────────────────────────────
    
    // Escuchar clic para crear nuevo evento
    cell.addEventListener('click', (e) => {
        // Solo si se hace clic en celda vacía o número del día
        if (e.target === cell || e.target === dayEl || e.target.textContent == date.getDate()) {
            openCreateEventModal({ date: toISO(date) });
        }
    });

    return cell;
}

// ─── CREACIÓN DE CHIPS DE EVENTOS ───────────────────────────────────────────

/**
 * Crea un chip (card compacto) para mostrar un evento en el calendario
 * @param {Object} ev - Datos del evento
 * @returns {Element} Elemento DOM del chip
 */
function makeEventChip(ev) {
    // Crear elemento div para el chip
    const chip = document.createElement('div');
    chip.className = `calendar-event ${TYPE_CLASS[ev.type] || 'event-normal'}`;
    chip.draggable = true;
    chip.dataset.eventId = ev._id;
    chip.dataset.originalDate = toISO(new Date(ev.date));

    // Preparar hora si existe
    const timeStr = ev.start_time ? `${ev.start_time} ` : '';
    
    // Estructura HTML del chip
    chip.innerHTML = `
        ${getEventCheckboxMarkup(ev)}
        <div class="event-text">
            <span class="event-title">${timeStr}${ev.title}</span>
            ${ev.description ? `<span class="event-description">${ev.description}</span>` : ''}
        </div>
        <div class="event-card-actions">
            <button type="button" class="event-action-btn event-action-edit" title="Editar evento"><i class="bi bi-pencil"></i></button>
            <button type="button" class="event-action-btn event-action-delete" title="Eliminar evento"><i class="bi bi-trash"></i></button>
        </div>`;

    // ─── BOTONES DE ACCIÓN ──────────────────────────────────────────────────────
    
    const editButton = chip.querySelector('.event-action-edit');
    const deleteButton = chip.querySelector('.event-action-delete');

    // Sincronizar estado visual del checkbox
    syncEventCompletionCard(chip, ev);
    
    // Vincular toggle de completado
    bindEventCompletionToggle(chip, ev, () => fetchAndRender());

    // Botón editar
    editButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openEditEventModal(ev, { onSaved: () => fetchAndRender(), onDeleted: () => fetchAndRender() });
    });

    // Botón eliminar
    deleteButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteEventById(ev._id, () => fetchAndRender());
    });

    // ─── EDITAR AL HACER CLIC EN CHIP ───────────────────────────────────────────
    
    chip.addEventListener('click', (e) => {
        // No abrir si se hace clic en botones de acción o checkbox
        if (e.target.closest('.event-card-actions') || e.target.closest('.event-checkbox')) return;
        openEditEventModal(ev, { onSaved: () => fetchAndRender(), onDeleted: () => fetchAndRender() });
    });

    // ─── DRAG & DROP ────────────────────────────────────────────────────────────
    
    // Iniciar drag
    chip.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('eventId', ev._id);
        e.dataTransfer.setData('originalDate', toISO(new Date(ev.date)));
        e.dataTransfer.setData('eventStartTime', ev.start_time || '');
        e.dataTransfer.setData('eventEndTime', ev.end_time || '');
        chip.style.opacity = '0.5';
    });
    
    // Finalizar drag
    chip.addEventListener('dragend', () => { chip.style.opacity = '1'; });

    return chip;
}

// ─── MANEJO DE DRAG & DROP ──────────────────────────────────────────────────────

/**
 * Maneja el drop de un evento en una nueva celda
 * Envía una actualización al servidor para cambiar la fecha
 * @param {DragEvent} e - Evento de drag
 */
async function handleDrop(e) {
    e.preventDefault();

    const cell = e.currentTarget;
    cell.classList.remove('drag-over');

    const eventId = e.dataTransfer.getData('eventId');
    const newDate = cell.dataset.date;
    const originalStartTime = e.dataTransfer.getData('eventStartTime');
    const originalEndTime = e.dataTransfer.getData('eventEndTime');

    if (!eventId || !newDate) return;

    const body = { date: newDate };
    if (originalStartTime) body.start_time = originalStartTime;
    if (originalEndTime) body.end_time = originalEndTime;

    // Actualización optimista: mover el evento en el array local y re-renderizar sin loader
    const idx = monthEvents.findIndex(ev => ev._id === eventId);
    if (idx === -1) return;
    const previous = { ...monthEvents[idx] };
    monthEvents[idx] = { ...monthEvents[idx], ...body };
    renderCalendar(monthEvents);

    // PATCH en segundo plano sin loader
    try {
        const res = await fetch(`${API_URL}/events/${eventId}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            // Revertir si falla
            monthEvents[idx] = previous;
            renderCalendar(monthEvents);
            alert('No se pudo mover el evento');
        }
    } catch {
        monthEvents[idx] = previous;
        renderCalendar(monthEvents);
        alert('Error de conexión');
    }
}
