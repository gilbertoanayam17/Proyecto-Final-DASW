// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN Y UTILIDADES GLOBALES (FRONTEND)
// ═══════════════════════════════════════════════════════════════════════════════
// Descripción: Archivo central con configuración global, funciones de sesión,
// funciones de utilidades de fecha y manejo de eventos.
// Se carga en todas las páginas HTML.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── CONFIGURACIÓN GLOBAL ───────────────────────────────────────────────────────
// URL base de la API del servidor (para desarrollo local)
const API_URL = 'http://localhost:3000';

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE SESIÓN Y AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Obtiene los datos del usuario sesión guardados en localStorage
 * @returns {Object|null} Objeto del usuario o null si no hay sesión
 */
function getSession() {
    return JSON.parse(localStorage.getItem('calendorx_user') || 'null');
}

/**
 * Guarda los datos del usuario en localStorage
 * @param {Object} user - Objeto del usuario a guardar
 */
function setSession(user) {
    localStorage.setItem('calendorx_user', JSON.stringify(user));
}

/**
 * Elimina la sesión y token del usuario (logout)
 */
function clearSession() {
    localStorage.removeItem('calendorx_user');
    localStorage.removeItem('calendorx_token');
}

/**
 * Obtiene el token JWT de autenticación guardado en localStorage
 * @returns {string|null} Token JWT o null si no existe
 */
function getToken() {
    return localStorage.getItem('calendorx_token');
}

/**
 * Guarda el token JWT en localStorage
 * @param {string} token - Token JWT a guardar
 */
function setToken(token) {
    localStorage.setItem('calendorx_token', token);
}

/**
 * Verifica si el usuario está autenticado. Si no, redirige a login.
 * @returns {Object|null} Datos del usuario autenticado, o null si no hay sesión
 */
function requireAuth() {
    const user = getSession();
    const token = getToken();
    
    // Si falta usuario o token, no hay sesión válida
    if (!user || !token) {
        // Redirigir a página de login
        window.location.href = 'login.html';
        return null;
    }
    return user;
}

/**
 * Genera headers HTTP para solicitudes autenticadas
 * Incluye: Content-Type y Authorization con Bearer token
 * @returns {Object} Headers para usar en fetch()
 */
function authHeaders() {
    const token = getToken();
    return { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}`
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES DE FECHA Y TIPO DE EVENTO
// ═══════════════════════════════════════════════════════════════════════════════

// Nombres de días de la semana (completos)
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Nombres de días de la semana (abreviados a 3 letras)
const DIAS_CORTO = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

// Nombres de meses
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES DE FECHA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convierte un Date LOCAL a string YYYY-MM-DD
 * Usa métodos locales (getFullYear, getMonth, getDate)
 * @param {Date} date - Fecha local a convertir
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Extrae la clave YYYY-MM-DD de una fecha del servidor (UTC midnight)
 * Usa métodos UTC para evitar desfase de zona horaria
 * Ejemplo: "2026-04-06T00:00:00.000Z" en UTC-6 → "2026-04-06"
 * @param {string|Date} evDate - Fecha ISO del servidor
 * @returns {string} Clave en formato YYYY-MM-DD
 */
function eventDateKey(evDate) {
    const d = new Date(evDate);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Compara si un Date local coincide con una fecha del servidor
 * @param {Date} localDate - Fecha local (navegación, hoy, etc.)
 * @param {string} serverDateStr - Fecha ISO del servidor
 * @returns {boolean} true si son el mismo día, false si no
 */
function sameDay(localDate, serverDateStr) {
    return toISO(localDate) === eventDateKey(serverDateStr);
}

/**
 * Obtiene la hora (0-23) de la hora de inicio de un evento
 * Usado para agrupar eventos por hora en vistas semanal/diaria
 * @param {Object} ev - Evento con campo start_time
 * @returns {number|null} Hora (0-23) o null si no hay start_time
 */
function eventHour(ev) {
    if (ev.start_time) return parseInt(ev.start_time.split(':')[0]);
    return null;
}

// ─── MAPEOS DE TIPO DE EVENTO ────────────────────────────────────────────────────

/**
 * Mapeo de tipos de evento a clases CSS para estilos
 */
const TYPE_CLASS = {
    'evento': 'event-normal',              // Evento normal
    'recordatorio': 'event-reminder',      // Recordatorio
    'fecha_importante': 'event-important'  // Fecha importante
};

/**
 * Mapeo de tipos de evento a etiquetas legibles
 */
const TYPE_LABEL = {
    'evento': 'Evento',
    'recordatorio': 'Recordatorio',
    'fecha_importante': 'Fecha importante'
};

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES DE EVENTOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcula la duración de un evento en horas (decimal)
 * @param {Object} ev - Evento con start_time y end_time
 * @returns {number|null} Duración en horas, o null si no tiene hora de inicio/fin
 */
function getEventDurationHours(ev) {
    if (!ev.start_time || !ev.end_time) return null;
    
    // Parsear hora y minutos
    const [sh, sm] = ev.start_time.split(':').map(Number);
    const [eh, em] = ev.end_time.split(':').map(Number);
    
    // Convertir a minutos desde inicio del día
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    
    // Validar que fin sea después de inicio
    if (endMin <= startMin) return null;
    
    // Retornar duración en horas
    return (endMin - startMin) / 60;
}

/**
 * Calcula el offset en minutos del inicio de un evento dentro de su hora
 * @param {Object} ev - Evento con start_time
 * @returns {number} Minutos desde el inicio de la hora (0-59)
 */
function getEventStartMinuteOffset(ev) {
    if (!ev.start_time) return 0;
    const [, sm] = ev.start_time.split(':').map(Number);
    return sm;
}

/**
 * Detecta si dos eventos se solapan en el mismo día
 * @param {string} ev1StartTime - Hora inicio evento 1 (HH:MM)
 * @param {string} ev1EndTime - Hora fin evento 1 (HH:MM)
 * @param {string} ev2StartTime - Hora inicio evento 2 (HH:MM)
 * @param {string} ev2EndTime - Hora fin evento 2 (HH:MM)
 * @returns {boolean} true si hay solapamiento, false si no
 */
function eventsOverlap(ev1StartTime, ev1EndTime, ev2StartTime, ev2EndTime) {
    // No puede haber solapamiento si falta alguna hora
    if (!ev1StartTime || !ev1EndTime || !ev2StartTime || !ev2EndTime) return false;
    
    // Parsear y convertir a minutos
    const [s1h, s1m] = ev1StartTime.split(':').map(Number);
    const [e1h, e1m] = ev1EndTime.split(':').map(Number);
    const [s2h, s2m] = ev2StartTime.split(':').map(Number);
    const [e2h, e2m] = ev2EndTime.split(':').map(Number);
    
    const start1 = s1h * 60 + s1m;
    const end1 = e1h * 60 + e1m;
    const start2 = s2h * 60 + s2m;
    const end2 = e2h * 60 + e2m;
    
    // Detectar solapamiento: 1 comienza antes de que 2 termine, y 2 comienza antes de que 1 termine
    return start1 < end2 && start2 < end1;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE ACTUALIZACIÓN DE INTERFAZ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Actualiza la fecha de hoy en el sidebar
 * Muestra el día y mes/año actuales
 */
function updateSidebarDate() {
    const now = new Date();
    const dayEl = document.getElementById('sidebarDay');
    const monthEl = document.getElementById('sidebarMonthYear');
    
    // Actualizar número del día
    if (dayEl) dayEl.textContent = now.getDate();
    
    // Actualizar mes y año
    if (monthEl) monthEl.textContent = `${MESES[now.getMonth()]} ${now.getFullYear()}`;
}

/**
 * Actualiza el nombre del usuario en la navegación
 * @param {Object} user - Datos del usuario autenticado
 */
function updateNavUser(user) {
    // Buscar todos los elementos con clase nav-user-name y actualizar con el nombre del usuario
    document.querySelectorAll('.nav-user-name').forEach(el => {
        el.textContent = user ? user.name : '';
    });
}

// ─── Modal "Nuevo Evento": lógica compartida ──────────────────────────────────

/**
 * Mapeo de recurrencia del backend a los valores del select del modal.
 * @type {Object}
 */
const EVENT_RECURRENCE_TO_SELECT = {
    none: 'none',
    daily: '1',
    weekly: '2',
    monthly: '3',
    yearly: '4'
};

/**
 * Mapeo de los valores del select del modal a la recurrencia del backend.
 * @type {Object}
 */
const EVENT_SELECT_TO_RECURRENCE = {
    '1': 'daily',
    '2': 'weekly',
    '3': 'monthly',
    '4': 'yearly'
};

/**
 * Estado global del modal de eventos para manejar su comportamiento y callbacks.
 * @type {Object}
 */
const eventModalState = {
    mode: 'create', // Puede ser 'create' o 'edit'
    eventId: null, // ID del evento cuando está en modo 'edit'
    onCreated: null, // Callback ejecutado tras crear un evento
    onSaved: null, // Callback ejecutado tras guardar un evento editado
    onDeleted: null, // Callback ejecutado tras eliminar un evento
    submitBound: false, // Indica si el evento de submit ya fue enlazado
    deleteBound: false, // Indica si el evento de eliminar ya fue enlazado
    hideBound: false // Indica si el evento de ocultar modal ya fue enlazado
};

/**
 * Obtiene los elementos del DOM relacionados con el modal de eventos.
 * @returns {Object} Diccionario con referencias a los elementos del modal.
 */
function getEventModalElements() {
    return {
        modal: document.getElementById('newEventModal'),
        title: document.getElementById('eventModalTitle'),
        submit: document.getElementById('btnCreateEventSubmit'),
        deleteButton: document.getElementById('btnDeleteEvent'),
        recurSelect: document.getElementById('eventRecur'),
        recurEndRow: document.getElementById('recurEndRow')
    };
}

/**
 * Determina el tipo de evento seleccionado en el modal.
 * @returns {string} 'recordatorio', 'fecha_importante' o 'evento'.
 */
function getSelectedEventType() {
    if (document.getElementById('btnReminder') && document.getElementById('btnReminder').checked) return 'recordatorio';
    if (document.getElementById('btnImportant') && document.getElementById('btnImportant').checked) return 'fecha_importante';
    return 'evento';
}

/**
 * Selecciona el tipo de evento en la interfaz del modal.
 * @param {string} type - Tipo de evento ('evento', 'recordatorio', 'fecha_importante').
 */
function setSelectedEventType(type) {
    if (document.getElementById('btnEvent')) document.getElementById('btnEvent').checked = type === 'evento';
    if (document.getElementById('btnReminder')) document.getElementById('btnReminder').checked = type === 'recordatorio';
    if (document.getElementById('btnImportant')) document.getElementById('btnImportant').checked = type === 'fecha_importante';
}

/**
 * Obtiene el valor del select de recurrencia en el modal basado en el valor del backend.
 * @param {string} recurrence - Valor de recurrencia del backend.
 * @returns {string} Valor correspondiente para el select del modal.
 */
function getModalRecurrenceValue(recurrence) {
    return EVENT_RECURRENCE_TO_SELECT[recurrence || 'none'] || 'none';
}

/**
 * Obtiene la recurrencia seleccionada en el modal y la mapea al formato del backend.
 * @returns {string} Valor de recurrencia para el backend.
 */
function getSelectedRecurrence() {
    const recurSelect = document.getElementById('eventRecur');
    return EVENT_SELECT_TO_RECURRENCE[recurSelect ? recurSelect.value : 'none'] || 'none';
}

/**
 * Verifica si un evento es recurrente.
 * @param {Object} event - Objeto del evento.
 * @returns {boolean} Verdadero si el evento es recurrente.
 */
function isRecurringEvent(event) {
    return (event?.recurrence || 'none') !== 'none';
}

/**
 * Verifica si un evento está marcado como completado.
 * @param {Object} event - Objeto del evento.
 * @returns {boolean} Verdadero si está completado.
 */
function isCompletedEvent(event) {
    return Boolean(event?.completed);
}

/**
 * Genera el markup HTML del checkbox para marcar un evento como completado.
 * Oculto si el evento es recurrente.
 * @param {Object} event - Objeto del evento.
 * @returns {string} String con el HTML del checkbox.
 */
function getEventCheckboxMarkup(event) {
    if (isRecurringEvent(event)) return '';
    return `<input type="checkbox" class="event-checkbox"${isCompletedEvent(event) ? ' checked' : ''}>`;
}

/**
 * Sincroniza el estado visual del checkbox en la tarjeta de un evento.
 * @param {HTMLElement} card - Elemento DOM de la tarjeta del evento.
 * @param {Object} event - Objeto del evento.
 */
function syncEventCompletionCard(card, event) {
    if (!card) return;

    const checkbox = card.querySelector('.event-checkbox');
    const completed = isCompletedEvent(event);
    const recurring = isRecurringEvent(event);

    card.classList.toggle('event-completed', completed);

    if (checkbox) {
        checkbox.checked = completed;
        checkbox.hidden = recurring;
        checkbox.disabled = recurring;
    }
}

/**
 * Guarda el estado de completado de un evento en el servidor.
 * @param {string} eventId - ID del evento.
 * @param {boolean} completed - Nuevo estado de completado.
 * @returns {Promise<Object>} Promesa con el evento actualizado.
 * @throws {Error} Si la petición al servidor falla.
 */
async function persistEventCompletion(eventId, completed) {
    const res = await fetchWithLoader(`${API_URL}/events/${eventId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ completed })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || 'No se pudo actualizar el estado del evento');
    }

    return data.event;
}

/**
 * Asocia el evento de cambio al checkbox de completado de la tarjeta.
 * @param {HTMLElement} card - Elemento DOM de la tarjeta del evento.
 * @param {Object} event - Objeto del evento original.
 * @param {Function} [onUpdated] - Callback opcional ejecutado al actualizar con éxito.
 */
function bindEventCompletionToggle(card, event, onUpdated) {
    const checkbox = card.querySelector('.event-checkbox');
    if (!checkbox || isRecurringEvent(event)) return;

    checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    checkbox.addEventListener('change', async (e) => {
        e.stopPropagation();
        const completed = checkbox.checked;
        try {
            const updatedEvent = await persistEventCompletion(event._id, completed);
            syncEventCompletionCard(card, updatedEvent);
            if (onUpdated) onUpdated(updatedEvent);
        } catch (err) {
            checkbox.checked = !completed;
            alert(err.message || 'No se pudo actualizar el estado del evento');
        }
    });
}

/**
 * Sincroniza la visibilidad de la fecha de fin de recurrencia.
 * Oculta el campo si la recurrencia seleccionada es "ninguna".
 */
function syncEventRecurrenceVisibility() {
    const recurSelect = document.getElementById('eventRecur');
    const recurEndRow = document.getElementById('recurEndRow');
    if (recurSelect && recurEndRow) {
        recurEndRow.style.display = recurSelect.value === 'none' ? 'none' : 'block';
    }
}

/**
 * Configura los textos del modal según si es creación o edición.
 * @param {string} mode - 'create' para nuevo, 'edit' para existente.
 */
function setEventModalMode(mode) {
    const { title, submit, deleteButton } = getEventModalElements();
    if (title) title.textContent = mode === 'edit' ? 'Editar Evento:' : 'Nuevo Evento:';
    if (submit) submit.textContent = mode === 'edit' ? 'Guardar Cambios' : 'Crear Evento';
    if (deleteButton) deleteButton.classList.toggle('d-none', mode !== 'edit');
}

/**
 * Limpia todos los campos del formulario del modal de eventos.
 */
function clearEventModalForm() {
    const title = document.getElementById('eventTitle');
    const description = document.getElementById('eventDesc');
    const date = document.getElementById('eventDate');
    const startTime = document.getElementById('startTime');
    const endTime = document.getElementById('endTime');
    const recurEnd = document.getElementById('eventRecurEnd');

    if (title) title.value = '';
    if (description) description.value = '';
    if (date) date.value = '';
    if (startTime) startTime.value = '';
    if (endTime) endTime.value = '';
    if (recurEnd) recurEnd.value = '';
    if (document.getElementById('eventRecur')) document.getElementById('eventRecur').value = 'none';
    setSelectedEventType('evento');
    syncEventRecurrenceVisibility();
}

/**
 * Rellena los campos del modal con la información de un evento existente.
 * @param {Object} event - Objeto del evento con sus datos.
 */
function fillEventModalForm(event) {
    if (!event) return;

    const title = document.getElementById('eventTitle');
    const description = document.getElementById('eventDesc');
    const date = document.getElementById('eventDate');
    const startTime = document.getElementById('startTime');
    const endTime = document.getElementById('endTime');
    const recurSelect = document.getElementById('eventRecur');
    const recurEnd = document.getElementById('eventRecurEnd');

    if (title) title.value = event.title || '';
    if (description) description.value = event.description || '';
    if (date) date.value = event.date ? eventDateKey(event.date) : '';
    if (startTime) startTime.value = event.start_time || '';
    if (endTime) endTime.value = event.end_time || '';
    if (recurSelect) recurSelect.value = getModalRecurrenceValue(event.recurrence);
    if (recurEnd) recurEnd.value = event.recurrence_end ? eventDateKey(event.recurrence_end) : '';
    setSelectedEventType(event.type || 'evento');
    syncEventRecurrenceVisibility();
}

/**
 * Recopila y estructura los datos ingresados en el formulario del modal de eventos.
 * @returns {Object} Payload con los datos del evento, incluyendo zona horaria y sincronización con Google.
 */
function getEventModalPayload() {
    const title = document.getElementById('eventTitle').value.trim();
    const description = document.getElementById('eventDesc').value.trim();
    const date = document.getElementById('eventDate').value;
    const recurEnd = document.getElementById('eventRecurEnd') ? document.getElementById('eventRecurEnd').value : '';
    const startTime = document.getElementById('startTime').value || null;
    const endTime = document.getElementById('endTime').value || null;
    const type = getSelectedEventType();
    const recurrence = getSelectedRecurrence();

    const syncGoogleEl = document.getElementById('syncGoogle');
    const sync_google = syncGoogleEl ? Boolean(syncGoogleEl.checked) : true;
    
    // Detectar zona horaria del navegador (zona IANA, ej: America/Mexico_City)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return {
        title,
        description,
        date,
        type,
        recurrence,
        recurrenceEnd: recurEnd,
        startTime,
        endTime,
        sync_google,
        timeZone
    };
}

/**
 * Cierra el modal de eventos actual si está abierto.
 */
function closeEventModal() {
    const { modal } = getEventModalElements();
    const modalInstance = modal ? bootstrap.Modal.getInstance(modal) || bootstrap.Modal.getOrCreateInstance(modal) : null;
    if (modalInstance) modalInstance.hide();
}

/**
 * Abre el modal en modo creación de evento, limpiando los campos y permitiendo precarga de datos.
 * @param {Object} prefill - Datos iniciales para precargar en el formulario (fecha, hora, tipo).
 */
function openCreateEventModal(prefill = {}) {
    eventModalState.mode = 'create';
    eventModalState.eventId = null;
    eventModalState.onSaved = null;
    eventModalState.onDeleted = null;
    setEventModalMode('create');
    clearEventModalForm();

    if (prefill.date && document.getElementById('eventDate')) document.getElementById('eventDate').value = prefill.date;
    if (prefill.startTime && document.getElementById('startTime')) document.getElementById('startTime').value = prefill.startTime;
    if (prefill.endTime && document.getElementById('endTime')) document.getElementById('endTime').value = prefill.endTime;
    if (prefill.type) setSelectedEventType(prefill.type);
    if (prefill.recurrence && document.getElementById('eventRecur')) document.getElementById('eventRecur').value = prefill.recurrence;
    if (prefill.recurrenceEnd && document.getElementById('eventRecurEnd')) document.getElementById('eventRecurEnd').value = prefill.recurrenceEnd;
    syncEventRecurrenceVisibility();

    const { modal } = getEventModalElements();
    if (modal) bootstrap.Modal.getOrCreateInstance(modal).show();
}

/**
 * Abre el modal en modo edición de evento, cargando los datos del evento proporcionado.
 * @param {Object} event - Evento a editar.
 * @param {Object} callbacks - Funciones a ejecutar al guardar (onSaved) o eliminar (onDeleted).
 */
function openEditEventModal(event, callbacks = {}) {
    if (!event || !event._id) return;

    eventModalState.mode = 'edit';
    eventModalState.eventId = event._id;
    eventModalState.onSaved = callbacks.onSaved || null;
    eventModalState.onDeleted = callbacks.onDeleted || null;

    setEventModalMode('edit');
    fillEventModalForm(event);

    const { modal } = getEventModalElements();
    if (modal) bootstrap.Modal.getOrCreateInstance(modal).show();
}

/**
 * Maneja el envío del formulario del modal para crear o actualizar un evento.
 * Verifica validaciones, conflictos de horario y se comunica con la API.
 */
async function submitEventModal() {
    const user = getSession();
    if (!user) return;

    const { submit } = getEventModalElements();
    const payload = getEventModalPayload();

    if (!payload.title) { alert('El título es obligatorio'); return; }
    if (!payload.date) { alert('La fecha es obligatoria'); return; }
    if (payload.recurrence !== 'none' && !payload.recurrenceEnd) {
        alert('Debes indicar hasta cuándo se repite el evento');
        return;
    }

    // ── Validación de conflicto de horarios ──
    if (payload.startTime && payload.endTime) {
        try {
            const conflictRes = await fetch(`${API_URL}/events?day=${payload.date}`, {
                headers: authHeaders()
            });
            if (conflictRes.ok) {
                const dayEvents = await conflictRes.json();
                const conflicting = dayEvents.filter(ev => {
                    // No comparar con el mismo evento si estamos editando
                    if (eventModalState.mode === 'edit' && ev._id === eventModalState.eventId) return false;
                    return eventsOverlap(payload.startTime, payload.endTime, ev.start_time, ev.end_time);
                });
                if (conflicting.length > 0) {
                    const conflictNames = conflicting.map(ev => {
                        const time = ev.start_time && ev.end_time ? `${ev.start_time} - ${ev.end_time}` : '';
                        return `• "${ev.title}" ${time}`;
                    }).join('\n');
                    const proceed = confirm(
                        `Conflicto de horario detectado!\n\nYa tienes evento(s) en ese horario:\n${conflictNames}\n\n¿Deseas crear el evento de todas formas?`
                    );
                    if (!proceed) return;
                }
            }
        } catch (e) {
            console.error('Error checking conflicts:', e);
        }
    }

    if (submit) {
        submit.disabled = true;
        submit.textContent = 'Guardando...';
    }

    try {
        const method = eventModalState.mode === 'edit' ? 'PATCH' : 'POST';
        const url = eventModalState.mode === 'edit' ? `${API_URL}/events/${eventModalState.eventId}` : `${API_URL}/events`;
        const res = await fetchWithLoader(url, {
            method,
            headers: authHeaders(),
            body: JSON.stringify({
                title: payload.title,
                description: payload.description,
                type: payload.type,
                date: payload.date,
                start_time: payload.startTime,
                end_time: payload.endTime,
                recurrence: payload.recurrence,
                recurrence_end: payload.recurrenceEnd || null,
                completed: false,
                sync_google: payload.sync_google,
                timeZone: payload.timeZone
            })
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.error || (eventModalState.mode === 'edit' ? 'Error al actualizar evento' : 'Error al crear evento'));
            return;
        }

        closeEventModal();
        clearEventModalForm();

        if (eventModalState.mode === 'edit') {
            if (eventModalState.onSaved) eventModalState.onSaved(data.event);
        } else if (eventModalState.onCreated) {
            eventModalState.onCreated(data.event);
        }
    } catch (err) {
        alert('Error de conexión con el servidor');
    } finally {
        if (submit) {
            submit.disabled = false;
            submit.textContent = eventModalState.mode === 'edit' ? 'Guardar Cambios' : 'Crear Evento';
        }
    }
}

/**
 * Elimina el evento que está actualmente en edición en el modal.
 * Solicita confirmación al usuario antes de procesar la eliminación.
 */
async function deleteCurrentEvent() {
    if (eventModalState.mode !== 'edit' || !eventModalState.eventId) return;
    const confirmed = confirm('¿Eliminar este evento? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    const { submit, deleteButton } = getEventModalElements();
    if (submit) submit.disabled = true;
    if (deleteButton) deleteButton.disabled = true;

    try {
        const res = await fetchWithLoader(`${API_URL}/events/${eventModalState.eventId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'No se pudo eliminar el evento');
            return;
        }

        closeEventModal();
        clearEventModalForm();
        if (eventModalState.onDeleted) eventModalState.onDeleted(data.event);
    } catch (err) {
        alert('Error de conexión con el servidor');
    } finally {
        if (submit) submit.disabled = false;
        if (deleteButton) deleteButton.disabled = false;
    }
}

/**
 * Elimina un evento directamente por su ID.
 * @param {string} eventId - ID del evento a eliminar.
 * @param {Function} [onDeleted] - Callback ejecutado tras eliminar con éxito.
 * @returns {Promise<boolean>} Verdadero si se eliminó con éxito, falso en caso contrario.
 */
async function deleteEventById(eventId, onDeleted) {
    if (!eventId) return false;
    const confirmed = confirm('¿Eliminar este evento? Esta acción no se puede deshacer.');
    if (!confirmed) return false;

    try {
        const res = await fetchWithLoader(`${API_URL}/events/${eventId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'No se pudo eliminar el evento');
            return false;
        }

        if (onDeleted) onDeleted(data.event);
        return true;
    } catch (err) {
        alert('Error de conexión con el servidor');
        return false;
    }
}

/**
 * Inicializa los eventos del DOM para el modal de nuevo evento.
 * Configura los botones de guardar, eliminar y cerrar.
 * @param {Function} [onCreated] - Callback predeterminado a ejecutar cuando se crea un evento nuevo.
 */
function initNewEventModal(onCreated) {
    eventModalState.onCreated = onCreated || null;

    const recurSelect = document.getElementById('eventRecur');
    const recurEndRow = document.getElementById('recurEndRow');
    if (recurSelect && recurEndRow) {
        recurSelect.addEventListener('change', () => {
            recurEndRow.style.display = recurSelect.value === 'none' ? 'none' : 'block';
        });
    }

    syncEventRecurrenceVisibility();

    const btnSubmit = document.getElementById('btnCreateEventSubmit');
    if (!btnSubmit) return;

    if (!eventModalState.submitBound) {
        btnSubmit.addEventListener('click', submitEventModal);
        eventModalState.submitBound = true;
    }

    const btnDelete = document.getElementById('btnDeleteEvent');
    if (btnDelete && !eventModalState.deleteBound) {
        btnDelete.addEventListener('click', deleteCurrentEvent);
        eventModalState.deleteBound = true;
    }

    const modal = document.getElementById('newEventModal');
    if (modal && !eventModalState.hideBound) {
        modal.addEventListener('hidden.bs.modal', () => {
            eventModalState.mode = 'create';
            eventModalState.eventId = null;
            eventModalState.onSaved = null;
            eventModalState.onDeleted = null;
            setEventModalMode('create');
            clearEventModalForm();
        });
        eventModalState.hideBound = true;
    }
}

// ─── Cerrar sesión ────────────────────────────────────────────────────────────

/**
 * Inicializa la funcionalidad para cerrar sesión, adjuntando listeners a los botones correspondientes.
 */
function initLogout() {
    document.querySelectorAll('.btn-logout-confirm').forEach(btn => {
        btn.addEventListener('click', () => {
            clearSession();
            window.location.href = 'login.html';
        });
    });
}

// ─── Conectar con Google Calendar (botón en navbar) ───────────────────────────

/**
 * Event listener global para iniciar la conexión OAuth con Google Calendar.
 */
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnConnectGoogle');
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            // Solicitar al backend la URL de autorización de Google
            const res = await fetch(`${API_URL}/auth/google/url`, {
                method: 'GET',
                headers: authHeaders()
            });
            // Procesar la respuesta del backend
            const data = await res.json();
            // Si la respuesta no es exitosa, mostrar error
            if (!res.ok) {
                alert(data.error || 'No se pudo iniciar conexión con Google');
                return;
            }
            // Si se recibió la URL, abrirla en una nueva ventana para que el usuario autorice
            if (data.url) {
                window.open(data.url, '_blank', 'width=900,height=700');
            }
        } catch (err) {
            alert('Error al conectar con el servidor');
        }
    });
});
