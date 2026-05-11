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

// Filtros activos (Set vacío = mostrar todos)
const activeFilters = new Set();

// Array de eventos del día actual
let dayEvents = [];

// Drop pendiente cuando se requiere confirmación para preservar minutos
let pendingDayDrop = null;

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

    // Cargar y renderizar eventos del día
    fetchAndRender();
}

// ─── FUNCIONES DE FILTRADO ──────────────────────────────────────────────────────

/**
 * Activa/desactiva un filtro y re-renderiza el día
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
    
    // Filtrar eventos según filtros activos (vacío = mostrar todos)
    const filtered = activeFilters.size === 0 ? events : events.filter(e => activeFilters.has(e.type));

    // ─── AGRUPAR POR HORA ───────────────────────────────────────────────────────
    
    // Agrupar eventos por hora usando UTC para evitar desfase
    const byHour = {};
    filtered.forEach(ev => {
        // Obtener hora (0-23) o -1 si no tiene start_time (evento sin hora)
        const h = ev.start_time ? parseInt(ev.start_time.split(':')[0]) : -1;
        if (!byHour[h]) byHour[h] = [];
        byHour[h].push(ev);
    });

    // ─── EVENTOS "TODO EL DÍA" (FILA FIJA SOBRE EL SCROLL) ─────────────────────
    const allDayContainer = document.getElementById('dailyAllDayEvents');
    if (allDayContainer) {
        allDayContainer.innerHTML = '';
        (byHour[-1] || []).forEach(ev => {
            allDayContainer.appendChild(makeAllDayCard(ev));
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
            const endHourStr = h < 23 ? String(h + 1).padStart(2, '0') + ':00' : '23:59';
            eventCell.addEventListener('click', () => {
                openCreateEventModal({ date: toISO(currentDay), startTime: hourStr, endTime: endHourStr });
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
        e.dataTransfer.setData('eventId', ev._id);
        e.dataTransfer.setData('eventDate', toISO(currentDay));
        e.dataTransfer.setData('eventStartTime', ev.start_time || '');
        e.dataTransfer.setData('eventEndTime', ev.end_time || '');
        card.style.opacity = '0.5';
    });
    
    // Finalizar drag
    card.addEventListener('dragend', () => { card.style.opacity = '1'; });
    
    return card;
}

/**
 * Crea una card simplificada para eventos "todo el día" en la vista diaria
 * Usa la misma estructura que makeWeekEventCard para garantizar que múltiples
 * eventos se apilen correctamente en el contenedor flex-column.
 * @param {Object} ev - Datos del evento
 * @returns {Element} Elemento DOM de la card
 */
function makeAllDayCard(ev) {
    const card = document.createElement('div');
    card.className = `calendar-event week-event-card ${TYPE_CLASS[ev.type] || 'event-normal'}`;
    card.draggable = false;
    card.dataset.eventId = ev._id;
    card.style.margin = '4px';

    card.innerHTML = `
        ${getEventCheckboxMarkup(ev)}
        <div class="week-event-content">
            <div class="week-event-title">${ev.title}</div>
            ${ev.description ? `<div class="week-event-subtitle">${ev.description}</div>` : ''}
        </div>
        <div class="event-card-actions">
            <button type="button" class="event-action-btn event-action-edit" title="Editar evento"><i class="bi bi-pencil"></i></button>
            <button type="button" class="event-action-btn event-action-delete" title="Eliminar evento"><i class="bi bi-trash"></i></button>
        </div>`;

    syncEventCompletionCard(card, ev);
    bindEventCompletionToggle(card, ev, () => fetchAndRender());

    card.querySelector('.event-action-edit').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openEditEventModal(ev, { onSaved: () => fetchAndRender(), onDeleted: () => fetchAndRender() });
    });

    card.querySelector('.event-action-delete').addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteEventById(ev._id, () => fetchAndRender());
    });

    card.addEventListener('click', (e) => {
        if (e.target.closest('.event-card-actions') || e.target.closest('.event-checkbox')) return;
        openEditEventModal(ev, { onSaved: () => fetchAndRender(), onDeleted: () => fetchAndRender() });
    });

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
    const originalDate = e.dataTransfer.getData('eventDate');
    const originalStartTime = e.dataTransfer.getData('eventStartTime');
    const originalEndTime = e.dataTransfer.getData('eventEndTime');
    
    // Obtener nueva hora desde el atributo data del elemento drop
    const newHour = cell.dataset.hour;
    
    // Validar que tengamos el evento
    if (!eventId) return;

    const originalStartMinutes = parseTimeToMinutes(originalStartTime);
    const originalEndMinutes = parseTimeToMinutes(originalEndTime);
    const originalStartOffset = originalStartMinutes !== null ? (originalStartMinutes % 60) : 0;
    const hasMinuteOffset = originalStartOffset !== 0;

    if (hasMinuteOffset) {
        pendingDayDrop = {
            eventId,
            newHour,
            originalStartMinutes,
            originalEndMinutes,
            originalStartOffset
        };
        showMinuteOffsetDropWarning({
            originalStartTime,
            originalEndTime,
            targetDate: toISO(currentDay),
            targetHour: newHour,
            originalStartOffset,
            onEdit: () => {
                const event = dayEvents.find(item => item._id === eventId);
                if (event) {
                    openEditEventModal(event, { onSaved: () => fetchAndRender(), onDeleted: () => fetchAndRender() });
                }
            },
            onAccept: async () => {
                await moveDayEvent(eventId, newHour, originalStartMinutes, originalEndMinutes, originalStartOffset);
            }
        });
        return;
    }

    await moveDayEvent(eventId, newHour, originalStartMinutes, originalEndMinutes, originalStartOffset);
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

async function moveDayEvent(eventId, newHour, originalStartMinutes, originalEndMinutes, originalStartOffset) {
    try {
        const body = { date: toISO(currentDay) };

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
        const idx = dayEvents.findIndex(ev => ev._id === eventId);
        if (idx !== -1) {
            dayEvents[idx] = { ...dayEvents[idx], ...body };
            renderDay(dayEvents);
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
