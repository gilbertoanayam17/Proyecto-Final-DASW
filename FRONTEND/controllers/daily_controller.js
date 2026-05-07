// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLADOR: VISTA DIARIA DEL CALENDARIO
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Gestiona la vista del calendario por día (24 horas).
// Incluye: grid de horas, filtrado, drag & drop, edición de eventos.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ESTADO GLOBAL ──────────────────────────────────────────────────────────────

// Día actual que se está visualizando
let currentDay = new Date();
currentDay.setHours(0, 0, 0, 0);

// Filtro activo: 'all' (todos), 'recordatorio', 'fecha_importante'
let activeFilter = 'all';

// Array de eventos del día actual
let dayEvents = [];

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

    // ─── NAVEGACIÓN DE DÍA ──────────────────────────────────────────────────────
    
    // Botón: ir al día anterior
    document.getElementById('prevDay').addEventListener('click', () => {
        currentDay.setDate(currentDay.getDate() - 1);
        fetchAndRender();
    });
    
    // Botón: ir al día siguiente
    document.getElementById('nextDay').addEventListener('click', () => {
        currentDay.setDate(currentDay.getDate() + 1);
        fetchAndRender();
    });
    
    // Botón: volver al día actual (hoy)
    document.getElementById('btnToday').addEventListener('click', () => {
        currentDay = new Date();
        currentDay.setHours(0, 0, 0, 0);
        fetchAndRender();
    });

    // ─── LISTENERS DE FILTROS ───────────────────────────────────────────────────
    
    // Botón: mostrar todos los eventos
    document.getElementById('filterNormal').addEventListener('click', (e) => { 
        e.preventDefault(); 
        setFilter('all'); 
    });
    
    // Botón: mostrar solo recordatorios
    document.getElementById('filterReminders').addEventListener('click', (e) => { 
        e.preventDefault(); 
        setFilter('recordatorio'); 
    });
    
    // Botón: mostrar solo fechas importantes
    document.getElementById('filterImportant').addEventListener('click', (e) => { 
        e.preventDefault(); 
        setFilter('fecha_importante'); 
    });

    // Cargar y renderizar eventos del día
    fetchAndRender();
}

// ─── FUNCIONES DE FILTRADO ──────────────────────────────────────────────────────

/**
 * Cambiar filtro activo y re-renderizar día
 * @param {string} f - Filtro a aplicar ('all', 'recordatorio', 'fecha_importante')
 */
function setFilter(f) {
    // Establecer filtro activo
    activeFilter = f;
    
    // Actualizar estado visual de botones de filtro
    document.getElementById('filterNormal').classList.toggle('active-cyan', f === 'all');
    document.getElementById('filterReminders').classList.toggle('active-cyan', f === 'recordatorio');
    document.getElementById('filterImportant').classList.toggle('active-cyan', f === 'fecha_importante');
    
    // Re-renderizar día con nuevo filtro
    renderDay(dayEvents);
}

// ─── CARGA Y RENDERIZACIÓN ──────────────────────────────────────────────────────

/**
 * Obtiene eventos del día del servidor y renderiza la vista
 */
async function fetchAndRender() {
    // Obtener fecha del día actual en formato YYYY-MM-DD
    const dateStr = toISO(currentDay);

    // ─── ACTUALIZAR HEADER DEL DÍA ──────────────────────────────────────────────

    // Actualizar nombre del día (ej: LUNES)
    document.getElementById('dailyDayName').textContent = DIAS[currentDay.getDay()].toUpperCase();
    
    // Actualizar número del día
    document.getElementById('dailyDayNum').textContent = currentDay.getDate();
    
    // Actualizar mes y año
    document.getElementById('dailyMonth').textContent = `${MESES[currentDay.getMonth()]} ${currentDay.getFullYear()}`;
    
    // Actualizar descripción completa (ej: Lunes, 7 de mayo de 2026)
    document.getElementById('dailySubtitle').textContent =
        `${DIAS[currentDay.getDay()]}, ${currentDay.getDate()} de ${MESES[currentDay.getMonth()]} de ${currentDay.getFullYear()}`;
    
    // Establecer fecha en el input del modal
    document.getElementById('eventDate').value = dateStr;

    try {
        // Solicitar eventos del día al servidor
        const res = await fetchWithLoader(`${API_URL}/events?day=${dateStr}`, {
            headers: authHeaders()
        });
        
        // Parsear eventos
        dayEvents = res.ok ? await res.json() : [];
    } catch { 
        // Error de conexión
        dayEvents = []; 
    }

    // Renderizar día con eventos obtenidos
    renderDay(dayEvents);
}

/**
 * Renderiza el grid de 24 horas con eventos del día
 * @param {Array} events - Array de eventos a mostrar
 */
function renderDay(events) {
    // Obtener elemento del cuerpo del calendario
    const body = document.getElementById('dailyBody');
    body.innerHTML = '';
    
    const today = new Date();
    
    // Filtrar eventos según filtro activo
    const filtered = activeFilter === 'all' ? events : events.filter(e => e.type === activeFilter);

    // ─── AGRUPAR POR HORA ───────────────────────────────────────────────────────
    
    // Agrupar eventos por hora usando UTC para evitar desfase
    const byHour = {};
    filtered.forEach(ev => {
        // Obtener hora (0-23) o -1 si no tiene start_time (evento sin hora)
        const h = ev.start_time ? parseInt(ev.start_time.split(':')[0]) : -1;
        if (!byHour[h]) byHour[h] = [];
        byHour[h].push(ev);
    });

    // ─── EVENTOS SIN HORA (AL TOP) ──────────────────────────────────────────────
    
    // Mostrar eventos sin hora específica al principio
    if (byHour[-1]) {
        byHour[-1].forEach(ev => {
            const allDayCell = document.createElement('div');
            allDayCell.className = 'daily-event-cell p-1';
            allDayCell.appendChild(makeDailyCard(ev));
            
            // Agregar placeholder para hora
            body.appendChild(document.createElement('div'));
            body.appendChild(allDayCell);
        });
    }

    // ─── GRID DE 24 HORAS ───────────────────────────────────────────────────────
    
    // Iterar sobre 24 horas del día
    for (let h = 0; h < 24; h++) {
        // Formato HH:00
        const hourStr = String(h).padStart(2, '0') + ':00';

        // ─── CELDA DE HORA ──────────────────────────────────────────────────────
        
        const timeCell = document.createElement('div');
        timeCell.className = 'daily-time-cell';
        timeCell.textContent = hourStr;
        body.appendChild(timeCell);

        // ─── CELDA DE EVENTOS ───────────────────────────────────────────────────
        
        const eventCell = document.createElement('div');
        eventCell.className = 'daily-event-cell p-1';
        eventCell.dataset.date = toISO(currentDay);
        eventCell.dataset.hour = h;

        // Agregar eventos de esta hora
        if (byHour[h] && byHour[h].length > 0) {
            byHour[h].forEach(ev => eventCell.appendChild(makeDailyCard(ev)));
        } else {
            // Si no hay eventos, permitir crear uno al hacer clic
            eventCell.addEventListener('click', () => {
                openCreateEventModal({ date: toISO(currentDay), startTime: hourStr });
            });
            
            // Mostrar hint de agregar evento
            const hint = document.createElement('span');
            hint.className = 'add-event-hint text-secondary';
            hint.textContent = '+ Agregar evento';
            eventCell.appendChild(hint);
        }

        // ─── DRAG & DROP ────────────────────────────────────────────────────────
        
        eventCell.addEventListener('dragover', (e) => { 
            e.preventDefault(); 
            eventCell.classList.add('drag-over'); 
        });
        eventCell.addEventListener('dragleave', () => eventCell.classList.remove('drag-over'));
        eventCell.addEventListener('drop', handleDrop);

        body.appendChild(eventCell);
    }

    // ─── SCROLL A HORA ACTUAL ───────────────────────────────────────────────────
    
    // Si es hoy, hacer scroll a la hora actual; si no, hacer scroll a las 08:00
    const scrollHour = toISO(currentDay) === toISO(today) ? today.getHours() : 8;
    document.querySelector('.week-body-scroll').scrollTop = scrollHour * 61;
}

/**
 * Crea una card de evento para la vista diaria
 * @param {Object} ev - Datos del evento
 * @returns {Element} Elemento DOM de la card
 */
function makeDailyCard(ev) {
    // Crear elemento div para la card
    const card = document.createElement('div');
    card.className = `calendar-event ${TYPE_CLASS[ev.type] || 'event-normal'} p-2 rounded-2`;
    card.draggable = true;
    card.dataset.eventId = ev._id;

    // ─── CALCULAR DURACIÓN Y POSICIÓN ───────────────────────────────────────────
    
    // Obtener duración en horas si tiene hora inicio y fin
    const durationHours = getEventDurationHours(ev);
    
    // Obtener offset en minutos del inicio de la hora
    const minuteOffset = getEventStartMinuteOffset(ev);
    
    if (durationHours && durationHours > 0) {
        // Si tiene duración específica, aplicar altura y posición
        card.classList.add('daily-event-duration');
        const heightPx = durationHours * 60; // 60px por hora
        const topPx = minuteOffset; // offset en minutos = px
        card.style.height = `${heightPx}px`;
        card.style.top = `${topPx}px`;
    }

    // ─── CONTENIDO DE LA CARD ───────────────────────────────────────────────────
    
    // Preparar hora si existe
    const timeStr = ev.start_time
        ? `<span class="daily-event-time">${ev.start_time}${ev.end_time ? ' - ' + ev.end_time : ''}</span>` 
        : '';

    card.innerHTML = `
        <div class="daily-event-wrapper">
            <div class="d-flex align-items-center gap-2">
                ${getEventCheckboxMarkup(ev)}
                <span class="fw-bold">${ev.title}</span>
            </div>
            ${timeStr}
            ${ev.description ? `<div class="text-secondary small mt-1">${ev.description}</div>` : ''}
        </div>
        <div class="event-card-actions">
            <button type="button" class="event-action-btn event-action-edit" title="Editar evento"><i class="bi bi-pencil"></i></button>
            <button type="button" class="event-action-btn event-action-delete" title="Eliminar evento"><i class="bi bi-trash"></i></button>
        </div>`;

    // ─── BOTONES DE ACCIÓN ──────────────────────────────────────────────────────
    
    const editButton = card.querySelector('.event-action-edit');
    const deleteButton = card.querySelector('.event-action-delete');

    // Sincronizar estado visual del checkbox
    syncEventCompletionCard(card, ev);
    
    // Vincular toggle de completado
    bindEventCompletionToggle(card, ev, () => fetchAndRender());

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

    // ─── EDITAR AL HACER CLIC EN CARD ───────────────────────────────────────────
    
    card.addEventListener('click', (e) => {
        // No abrir si se hace clic en botones de acción o checkbox
        if (e.target.closest('.event-card-actions') || e.target.closest('.event-checkbox')) return;
        openEditEventModal(ev, { onSaved: () => fetchAndRender(), onDeleted: () => fetchAndRender() });
    });

    // ─── DRAG & DROP ────────────────────────────────────────────────────────────
    
    // Iniciar drag
    card.addEventListener('dragstart', (e) => {
        // Si el evento dura más de 1 hora, mostrar advertencia y cancelar drag
        if (durationHours > 1) {
            e.preventDefault();
            showMultiHourDragWarning(ev, durationHours);
            return;
        }
        
        e.dataTransfer.setData('eventId', ev._id);
        card.style.opacity = '0.5';
    });
    
    // Finalizar drag
    card.addEventListener('dragend', () => { card.style.opacity = '1'; });
    
    return card;
}

// ─── MANEJO DE DRAG & DROP ──────────────────────────────────────────────────────

/**
 * Maneja el drop de un evento en una nueva celda
 * @param {DragEvent} e - Evento de drag
 */
async function handleDrop(e) {
    e.preventDefault();
    
    // Remover estilo de drag over
    const cell = e.currentTarget;
    cell.classList.remove('drag-over');
    
    // Obtener ID del evento
    const eventId = e.dataTransfer.getData('eventId');
    
    // Obtener nueva hora desde el atributo data del elemento drop
    const newHour = cell.dataset.hour;
    
    // Validar que tengamos el evento
    if (!eventId) return;

    // Construir cuerpo de la solicitud con nueva fecha y hora
    const body = { date: toISO(currentDay) };

    // Si el evento no tiene hora, no establecer start_time (permite eventos sin hora)
    if (newHour !== undefined) body.start_time = `${String(newHour).padStart(2,'0')}:00`;

    try {
        // Enviar solicitud PATCH para actualizar la fecha del evento
        const res = await fetchWithLoader(`${API_URL}/events/${eventId}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify(body)
        });
        // Si hay error, mostrar alerta
        if (!res.ok) { alert('No se pudo mover el evento'); return; }
        // Re-cargar y renderizar calendario
        fetchAndRender();
    } catch { alert('Error de conexión'); }
}

/**
 * Muestra una modal de advertencia para eventos multi-hora
 * @param {Object} ev - Datos del evento
 * @param {number} durationHours - Duración del evento en horas
 */
function showMultiHourDragWarning(ev, durationHours) {
    // Obtener la hora de inicio
    const startTime = ev.start_time || '00:00';
    const startHour = parseInt(startTime.split(':')[0]);
    
    // Crear modal HTML
    const modalHTML = `
        <div class="modal fade" id="multiHourDragModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-warning-light border-0">
                        <h5 class="modal-title fw-bold">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Evento Multi-hora
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="mb-3">
                            Este evento dura <strong>${durationHours.toFixed(1)} horas</strong> y abarca múltiples celdas horarias.
                        </p>
                        <p class="mb-4">
                            Al mover este evento mediante drag & drop, su hora de inicio se cambiará a la del horario de destino 
                            (<strong>HH:00</strong>), lo que podría modificar la duración exacta.
                        </p>
                        <div class="alert alert-info alert-sm mb-0" role="alert">
                            <i class="bi bi-info-circle me-2"></i>
                            <strong>Se te solicita usar el modal de edición para preservar la hora exacta.</strong><br>
                        </div>
                    </div>
                    <div class="modal-footer border-top-0">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-info" id="btnEditEvent" data-bs-dismiss="modal">Editar evento</button>
                    </div>
                </div>
            </div>
        </div>`;
    
    // Remover modal anterior si existe
    const oldModal = document.getElementById('multiHourDragModal');
    if (oldModal) oldModal.remove();
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Obtener referencia a la modal
    const modalEl = document.getElementById('multiHourDragModal');
    
    // Vincular botón "Editar evento"
    modalEl.querySelector('#btnEditEvent').addEventListener('click', () => {
        openEditEventModal(ev, { 
            onSaved: () => fetchAndRender(), 
            onDeleted: () => fetchAndRender() 
        });
    });
    
    // Mostrar modal
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    
    // Limpiar modal del DOM cuando se cierre
    modalEl.addEventListener('hidden.bs.modal', () => {
        modalEl.remove();
    });
}
