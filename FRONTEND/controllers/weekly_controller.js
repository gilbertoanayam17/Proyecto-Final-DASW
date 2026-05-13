// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLADOR: VISTA SEMANAL DEL CALENDARIO
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Gestiona la vista del calendario por semana (7 columnas x 24 horas).
// Incluye: grid de horas, filtrado, drag & drop, edición de eventos.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ESTADO GLOBAL ──────────────────────────────────────────────────────────────

// Inicio de la semana actual (lunes)
let weekStart = getMonday(new Date());

// Filtros activos (Set vacío = mostrar todos)
const activeFilters = new Set();

// Array de eventos de la semana
let weekEvents = [];

// Drop pendiente cuando se requiere confirmación para preservar minutos
let pendingWeekDrop = null;

// ─── FUNCIONES AUXILIARES ───────────────────────────────────────────────────────

/**
 * Calcula el lunes (inicio de semana) de la fecha dada
 * @param {Date} date - Fecha de referencia
 * @returns {Date} Lunes de esa semana a las 00:00
 */
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    // Si es domingo (0), retroceder 6 días; si no, restar hasta lunes
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

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

    // ─── NAVEGACIÓN DE SEMANA ───────────────────────────────────────────────────
    
    // Botón: ir a la semana anterior
    document.getElementById('prevWeek').addEventListener('click', () => {
        weekStart.setDate(weekStart.getDate() - 7);
        fetchAndRender();
    });
    
    // Botón: ir a la semana siguiente
    document.getElementById('nextWeek').addEventListener('click', () => {
        weekStart.setDate(weekStart.getDate() + 7);
        fetchAndRender();
    });
    
    // Botón: volver a la semana actual (hoy)
    document.getElementById('btnToday').addEventListener('click', () => {
        weekStart = getMonday(new Date());
        fetchAndRender();
    });

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

    // Cargar y renderizar eventos de la semana
    fetchAndRender();
}

// ─── FUNCIONES DE FILTRADO ──────────────────────────────────────────────────────

/**
 * Activa/desactiva un filtro y re-renderiza la semana
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

    renderWeek(weekEvents);
}

// ─── CARGA Y RENDERIZACIÓN ──────────────────────────────────────────────────────

/**
 * Obtiene eventos de la semana del servidor y renderiza la vista
 */
async function fetchAndRender() {
    // Calcular fin de semana (domingo)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Actualizar título con rango de fechas
    const startStr = `${weekStart.getDate()} ${MESES[weekStart.getMonth()].slice(0,3).toLowerCase()}`;
    const endStr = `${weekEnd.getDate()} ${MESES[weekEnd.getMonth()].slice(0,3).toLowerCase()} ${weekEnd.getFullYear()}`;
    document.getElementById('weekRangeTitle').textContent = `${startStr} – ${endStr}`;

    // Obtener rango de fechas en formato YYYY-MM-DD
    const start = toISO(weekStart);
    const end = toISO(weekEnd);

    try {
        // Solicitar eventos de la semana al servidor
        const res = await fetchWithLoader(`${API_URL}/events?start=${start}&end=${end}`, {
            headers: authHeaders()
        });
        
        // Parsear eventos
        weekEvents = res.ok ? await res.json() : [];
    } catch { 
        // Error de conexión
        weekEvents = []; 
    }

    // Renderizar semana con eventos obtenidos
    renderWeek(weekEvents);
}

/**
 * Renderiza el grid de 7 días × 24 horas con eventos
 * @param {Array} events - Array de eventos a mostrar
 */
function renderWeek(events) {
    const today = new Date();
    
    // Filtrar eventos según filtros activos (vacío = mostrar todos)
    const filtered = activeFilters.size === 0 ? events : events.filter(e => activeFilters.has(e.type));

    // Agrupar eventos por fecha+hora usando UTC para evitar desfase
    const byDateHour = {};
    filtered.forEach(ev => {
        // Obtener fecha del evento
        const dateKey = eventDateKey(ev.date);
        
        // Obtener hora (0-23) o null si es evento sin hora
        const hour = ev.start_time ? parseInt(ev.start_time.split(':')[0]) : null;
        
        // Crear clave única fecha_hora
        const k = `${dateKey}_${hour}`;
        if (!byDateHour[k]) byDateHour[k] = [];
        byDateHour[k].push(ev);
    });

    // ─── ACTUALIZAR HEADERS DE DÍAS ──────────────────────────────────────────────
    
    // Iterar sobre 7 días de la semana
    for (let i = 0; i < 7; i++) {
        // Calcular fecha del día
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        
        // Obtener elemento header del día
        const header = document.getElementById(`day-${i}`);
        if (!header) continue;
        
        // Verificar si es hoy (comparar fechas locales; sameDay() asume fecha del servidor en UTC)
        const isToday = toISO(d) === toISO(today);
        
        // Actualizar HTML del header
        header.innerHTML = `
            <span class="day-name">${DIAS_CORTO[d.getDay()]}</span>
            <span class="day-num${isToday ? ' today-num' : ''}">${d.getDate()}</span>`;
        header.className = `week-day-header${isToday ? ' today-header' : ''}`;
    }

    // ─── FILA "TODO EL DÍA" ──────────────────────────────────────────────────────
    const allDayRow = document.getElementById('weekAllDayRow');
    if (allDayRow) {
        allDayRow.innerHTML = '';
        const gutter = document.createElement('div');
        gutter.className = 'week-all-day-gutter';
        gutter.textContent = 'todo el día';
        allDayRow.appendChild(gutter);
        for (let d = 0; d < 7; d++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + d);
            const dateKey = toISO(date);
            const cell = document.createElement('div');
            cell.className = 'week-all-day-cell';
            filtered.filter(ev => eventDateKey(ev.date) === dateKey && !ev.start_time)
                .forEach(ev => {
                    const card = makeWeekEventCard(ev);
                    card.draggable = false;
                    cell.appendChild(card);
                });
            allDayRow.appendChild(cell);
        }
    }

    // ─── RECONSTRUIR GRID DE HORAS Y EVENTOS ────────────────────────────────────

    // Obtener elemento del cuerpo del calendario
    const body = document.getElementById('weekBody');
    body.innerHTML = '';

    // Iterar sobre 24 horas del día
    for (let h = 0; h < 24; h++) {
        // Formato HH:00
        const hourStr = String(h).padStart(2, '0') + ':00';

        // ─── CELDA DE HORA ──────────────────────────────────────────────────────
        
        const timeCell = document.createElement('div');
        timeCell.className = 'week-time-cell';
        timeCell.textContent = hourStr;
        body.appendChild(timeCell);

        // ─── CELDAS DE EVENTOS (7 DÍAS) ─────────────────────────────────────────
        
        // Iterar sobre 7 días de la semana
        for (let d = 0; d < 7; d++) {
            // Calcular fecha del día
            const date = new Date(weekStart);
            date.setDate(date.getDate() + d);
            const dateKey = toISO(date);
            
            // Crear clave para buscar eventos de esta hora
            const k = `${dateKey}_${h}`;

            // Crear celda del grid
            const cell = document.createElement('div');
            cell.className = 'week-cell';
            cell.dataset.date = dateKey;
            cell.dataset.hour = h;

            // Agregar eventos de esta hora
            if (byDateHour[k]) {
                byDateHour[k].forEach(ev => {
                    cell.appendChild(makeWeekEventCard(ev));
                });
            } else {
                // Si no hay eventos, permitir crear uno al hacer clic
                const endHourStr = h < 23 ? String(h + 1).padStart(2, '0') + ':00' : '23:59';
                cell.addEventListener('click', () => {
                    openCreateEventModal({ date: dateKey, startTime: hourStr, endTime: endHourStr });
                });
                
                // Mostrar hint de agregar evento
                const hint = document.createElement('span');
                hint.className = 'add-event-hint';
                hint.textContent = '+ Agregar evento';
                cell.appendChild(hint);
            }

            // ─── DRAG & DROP ────────────────────────────────────────────────────
            
            cell.addEventListener('dragover', (e) => { 
                e.preventDefault(); 
                cell.classList.add('drag-over'); 
            });
            cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
            cell.addEventListener('drop', handleDrop);

            body.appendChild(cell);
        }
    }

    // ─── SCROLL A HORA ACTUAL ───────────────────────────────────────────────────
    
    // Si la semana actual incluye hoy, hacer scroll a la hora actual
    // Si no, hacer scroll a las 08:00
    const scrollHour = toISO(today) >= toISO(weekStart) && toISO(today) <= toISO(new Date(weekStart.getTime() + 6 * 86400000))
        ? today.getHours() 
        : 8;
    document.querySelector('.week-body-scroll').scrollTop = scrollHour * 61;

    // ─── SINCRONIZAR ANCHO DE HEADER Y ALL-DAY CON EL SCROLLBAR ────────────────
    // El scrollbar del body reduce el ancho del contenido; compensamos con padding-right
    const scrollEl = document.querySelector('.week-body-scroll');
    if (scrollEl) {
        const scrollbarWidth = scrollEl.offsetWidth - scrollEl.clientWidth;
        const headerGrid = document.querySelector('.week-header-grid');
        const allDayGrid = document.getElementById('weekAllDayRow');
        if (headerGrid) headerGrid.style.paddingRight = scrollbarWidth + 'px';
        if (allDayGrid) allDayGrid.style.paddingRight = scrollbarWidth + 'px';
    }
}

/**
 * Crea una card de evento para la vista semanal
 * @param {Object} ev - Datos del evento
 * @returns {Element} Elemento DOM de la card
 */
function makeWeekEventCard(ev) {
    // Crear elemento div para la card
    const card = document.createElement('div');
    card.className = `calendar-event week-event-card ${TYPE_CLASS[ev.type] || 'event-normal'}`;
    card.draggable = true;
    card.dataset.eventId = ev._id;

    // ─── CALCULAR DURACIÓN Y POSICIÓN ───────────────────────────────────────────
    
    // Obtener duración en horas si tiene hora inicio y fin
    const durationHours = getEventDurationHours(ev);
    
    // Obtener offset en minutos del inicio de la hora
    const minuteOffset = getEventStartMinuteOffset(ev);
    
    if (durationHours && durationHours > 0) {
        // Si tiene duración específica, mostrar como bloque
        card.classList.add('event-duration');
        const heightPx = durationHours * 60; // 60px por hora
        const topPx = minuteOffset; // offset en minutos = px
        card.style.height = `${heightPx}px`;
        card.style.top = `${topPx}px`;
    } else {
        // Si no, mostrar como chip pequeño
        card.style.margin = '4px';
    }

    // ─── CONTENIDO DE LA CARD ───────────────────────────────────────────────────
    
    // Preparar hora si existe
    const timeStr = ev.start_time
        ? `<div class="week-event-time">${ev.start_time}${ev.end_time ? ' - ' + ev.end_time : ''}</div>` 
        : '';

    card.innerHTML = `
        ${getEventCheckboxMarkup(ev)}
        <div class="week-event-content">
            ${timeStr}
            <div class="week-event-title">${ev.title}</div>
            ${ev.description ? `<div class="week-event-subtitle">${ev.description}</div>` : ''}
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

    // Hacer clic en la card (excepto botones) abre modal de edición
    card.addEventListener('click', (e) => {
        if (e.target.closest('.event-card-actions') || e.target.closest('.event-checkbox')) return;
        openEditEventModal(ev, { onSaved: () => fetchAndRender(), onDeleted: () => fetchAndRender() });
    });

    // ─── DRAG & DROP ────────────────────────────────────────────────────────────

    // Iniciar drag
    card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('eventId', ev._id);
        e.dataTransfer.setData('eventDate', toISO(new Date(ev.date)));
        e.dataTransfer.setData('eventStartTime', ev.start_time || '');
        e.dataTransfer.setData('eventEndTime', ev.end_time || '');
        card.style.opacity = '0.5';
    });
    // Finalizar drag
    card.addEventListener('dragend', () => { card.style.opacity = '1'; });
    return card;
}

// Función para manejar el drop de un evento en una nueva celda
async function handleDrop(e) {
    e.preventDefault();

    // Remover estilo de drag over
    const cell = e.currentTarget;
    cell.classList.remove('drag-over');

    // Obtener ID del evento y nueva fecha y hora
    const eventId = e.dataTransfer.getData('eventId');
    const originalDate = e.dataTransfer.getData('eventDate');
    const newDate = cell.dataset.date;
    const newHour = cell.dataset.hour;
    const originalStartTime = e.dataTransfer.getData('eventStartTime');
    const originalEndTime = e.dataTransfer.getData('eventEndTime');

    // Validar que tengamos ambos datos
    if (!eventId || !newDate) return;

    const originalStartMinutes = parseTimeToMinutes(originalStartTime);
    const originalEndMinutes = parseTimeToMinutes(originalEndTime);
    const originalStartOffset = originalStartMinutes !== null ? (originalStartMinutes % 60) : 0;
    const hasMinuteOffset = originalStartOffset !== 0;

    if (hasMinuteOffset) {
        pendingWeekDrop = {
            eventId,
            newDate,
            newHour,
            originalStartMinutes,
            originalEndMinutes,
            originalStartOffset
        };
        showMinuteOffsetDropWarning({
            eventId,
            originalDate,
            originalStartTime,
            originalEndTime,
            targetDate: newDate,
            targetHour: newHour,
            originalStartOffset,
            onEdit: () => {
                const event = weekEvents.find(item => item._id === eventId);
                if (event) {
                    openEditEventModal(event, { onSaved: () => fetchAndRender(), onDeleted: () => fetchAndRender() });
                }
            },
            onAccept: async () => {
                await moveWeekEvent(eventId, newDate, newHour, originalStartMinutes, originalEndMinutes, originalStartOffset);
            }
        });
        return;
    }

    await moveWeekEvent(eventId, newDate, newHour, originalStartMinutes, originalEndMinutes, originalStartOffset);
}

function parseTimeToMinutes(timeStr) {
    if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
    const [h, m] = timeStr.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
}

function formatMinutesToTime(minutes) {
    const clamped = Math.min(Math.max(minutes, 0), 1439);
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function moveWeekEvent(eventId, newDate, newHour, originalStartMinutes, originalEndMinutes, originalStartOffset) {
    try {
        const body = { date: newDate };

        if (newHour !== undefined) {
            const newStartMinutes = Number(newHour) * 60 + originalStartOffset;
            body.start_time = formatMinutesToTime(newStartMinutes);

            if (
                originalStartMinutes !== null &&
                originalEndMinutes !== null &&
                originalEndMinutes > originalStartMinutes
            ) {
                const durationMinutes = originalEndMinutes - originalStartMinutes;
                body.end_time = formatMinutesToTime(newStartMinutes + durationMinutes);
            }
        }

        // ── Validación de conflicto de horarios ──
        if (body.start_time && body.end_time) {
            try {
                const conflictRes = await fetch(`${API_URL}/events?day=${body.date}`, {
                    headers: authHeaders()
                });
                if (conflictRes.ok) {
                    const allEvents = await conflictRes.json();
                    const conflicting = allEvents.filter(ev => {
                        if (ev._id === eventId) return false;
                        return eventsOverlap(body.start_time, body.end_time, ev.start_time, ev.end_time);
                    });
                    if (conflicting.length > 0) {
                        const conflictNames = conflicting.map(ev => {
                            const time = ev.start_time && ev.end_time ? `${ev.start_time} - ${ev.end_time}` : '';
                            return `• "${ev.title}" ${time}`;
                        }).join('\n');
                        const proceed = confirm(
                            `Conflicto de horario detectado!\n\nYa tienes evento(s) en ese horario:\n${conflictNames}\n\n¿Deseas mover el evento de todas formas?`
                        );
                        if (!proceed) return;
                    }
                }
            } catch (err) {
                console.error('Error checking conflicts:', err);
            }
        }

        // Actualización optimista: re-renderizar inmediatamente sin loader ni reset de scroll
        const scrollEl = document.querySelector('.week-body-scroll');
        const savedScroll = scrollEl ? scrollEl.scrollTop : 0;
        const idx = weekEvents.findIndex(ev => ev._id === eventId);
        if (idx !== -1) {
            weekEvents[idx] = { ...weekEvents[idx], ...body };
            renderWeek(weekEvents);
            if (scrollEl) scrollEl.scrollTop = savedScroll;
        }

        // PATCH en segundo plano sin loader
        const res = await fetch(`${API_URL}/events/${eventId}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            alert('No se pudo mover el evento');
            fetchAndRender();
        }
    } catch {
        alert('Error de conexión');
        fetchAndRender();
    }
}

/**
 * Muestra una modal de advertencia para eventos multi-hora
 * @param {Object} ev - Datos del evento
 * @param {number} durationHours - Duración del evento en horas
 */
function showMinuteOffsetDropWarning({ originalStartTime, originalEndTime, targetDate, targetHour, originalStartOffset, onAccept, onEdit }) {
    // Crear modal HTML
    const modalHTML = `
        <div class="modal fade" id="multiHourDragModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-warning-light border-0">
                        <h5 class="modal-title fw-bold">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Nota de arrastre
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="mb-3">Nota: este evento no inicia en hora en punto.</p>
                        <p class="mb-4">
                            Hacer drop en esta celda asumirá que su hora de inicio sea la de la nueva celda, pero con los minutos que tiene el evento actualmente.
                            Si no es lo que deseas, puedes usar el modal de edición para darle el inicio/fin que desees.
                        </p>
                        <div class="alert alert-info alert-sm mb-0" role="alert">
                            <i class="bi bi-info-circle me-2"></i>
                            Inicio actual: <strong>${originalStartTime || '--:--'}</strong> | Fin actual: <strong>${originalEndTime || '--:--'}</strong><br>
                            Destino: <strong>${targetDate} ${String(targetHour).padStart(2, '0')}:00</strong> + ${String(originalStartOffset).padStart(2, '0')} min.
                        </div>
                    </div>
                    <div class="modal-footer border-top-0">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-outline-info" id="btnEditEvent" data-bs-dismiss="modal">Editar evento</button>
                        <button type="button" class="btn btn-info" id="btnAcceptDrop" data-bs-dismiss="modal">Aceptar</button>
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
        if (typeof onEdit === 'function') onEdit();
    });

    modalEl.querySelector('#btnAcceptDrop').addEventListener('click', () => {
        if (typeof onAccept === 'function') onAccept();
    });
    
    // Mostrar modal
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    
    // Limpiar modal del DOM cuando se cierre
    modalEl.addEventListener('hidden.bs.modal', () => {
        modalEl.remove();
    });
}

