'use strict';

/* ============================================================
   SIMUIPS — MOTOR PRINCIPAL
   Versión limpia compatible con el HTML nuevo.

   IMPORTANTE:
   - No contiene catálogos oficiales inventados.
   - Los catálogos se cargan desde /data/.
   - localStorage = cuentas y datos persistentes del prototipo.
   - sessionStorage = sesiones temporales de invitados.
   ============================================================ */

/* MODO INVITADO: autenticación y conexión a bases de datos eliminadas. */

const APP = Object.freeze({

    name: 'SimuIPS',

    version: '3.0.0',

    data: {
        iss: './data/iss.json',
        cups: './data/cups.json',
        cie10: './data/cie10.json',
        cum: './data/cum.json',
        eps: './data/eps.json',
        cases: './data/cases.json'
    },

    storage: {
        users: 'simuips_users',
        session: 'simuips_session',
        classes: 'simuips_classes',
        cases: 'simuips_cases',
        activities: 'simuips_activities',
        enrollments: 'simuips_enrollments',
        attempts: 'simuips_attempts',
        history: 'simuips_history',
        progress: 'simuips_progress',
        settings: 'simuips_settings'
    },

    guest: {
        session: 'simuips_guest_session',
        activity: 'simuips_guest_activity',
        progress: 'simuips_guest_progress',
        attempts: 'simuips_guest_attempts'
    },

    levels: [
        ['Aprendiz', 0],
        ['Auxiliar', 250],
        ['Analista', 600],
        ['Facturador', 1200],
        ['Auditor', 2200],
        ['Especialista', 4000],
        ['Experto IPS', 7000]
    ]

});


/* ============================================================
   ESTADO
============================================================ */

const state = {

    user: null,

    guest: false,

    page: 'dashboard',

    users: [],
    classes: [],
    cases: [],
    activities: [],
    enrollments: [],
    attempts: [],
    history: [],

    progress: {
        xp: 0,
        level: 1,
        completedCases: 0,
        correctCases: 0,
        totalAttempts: 0,
        streak: 0
    },

    settings: {
        notifications: true,
        sound: true,
        feedback: true
    },

    currentCase: null,

    currentActivity: null,

    currentActivityCases: [],

    currentCaseIndex: 0,

    currentMode: 'manual',

    currentLiquidation: null,

    currentValidation: null,

    selectedProcedure: null,

    selectedDiagnosis: null,

    editingCaseId: null,

    editingActivityId: null,

    selectedActivityCases: [],

    catalogs: {
        iss: null,
        cups: null,
        cie10: null,
        cum: null,
        eps: null,
        cases: null
    },

    catalogPromises: {},

    pendingGuestActivityId: null,

    guestState: null

};


/* ============================================================
   HELPERS DOM
============================================================ */

const $ = id => document.getElementById(id);

function text(id, value) {

    const element = $(id);

    if (element) {

        element.textContent = value ?? '';

    }

}


function value(id) {

    return String(
        $(id)?.value ?? ''
    ).trim();

}


function setValue(id, valueToSet) {

    const element = $(id);

    if (element) {

        element.value =
            valueToSet ?? '';

    }

}


function show(id) {

    $(id)?.classList.remove('hidden');

}


function hide(id) {

    $(id)?.classList.add('hidden');

}


function toggle(id, visible) {

    $(id)?.classList.toggle(
        'hidden',
        !visible
    );

}


function clone(object) {

    if (object === null ||
        object === undefined) {

        return object;

    }

    return JSON.parse(
        JSON.stringify(object)
    );

}


function generateId(prefix) {

    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

}


function escapeHTML(valueToEscape) {

    return String(
        valueToEscape ?? ''
    ).replace(
        /[&<>'"]/g,
        character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        })[character]
    );

}


function normalize(valueToNormalize) {

    return String(
        valueToNormalize ?? ''
    )
        .normalize('NFD')
        .replace(
            /[\u0300-\u036f]/g,
            ''
        )
        .toLowerCase()
        .trim();

}


function numberValue(valueToConvert) {

    if (
        typeof valueToConvert ===
        'number'
    ) {

        return Number.isFinite(
            valueToConvert
        )
            ? valueToConvert
            : 0;

    }

    let normalized = String(valueToConvert ?? '')
        .trim()
        .replace(/[\s$]/g, '')
        .replace(/[^0-9,.-]/g, '');

    if (!normalized) return 0;

    const lastComma = normalized.lastIndexOf(',');
    const lastDot = normalized.lastIndexOf('.');

    // Acepta formatos colombianos (2.500,00), internacionales (2,500.00)
    // y números simples (2500). El último separador es decimal cuando
    // aparecen coma y punto; un único separador con 3 cifras a la derecha
    // se interpreta como separador de miles.
    if (lastComma !== -1 && lastDot !== -1) {
        const decimalSeparator = lastComma > lastDot ? ',' : '.';
        const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
        normalized = normalized.split(thousandsSeparator).join('');
        if (decimalSeparator === ',') normalized = normalized.replace(',', '.');
    } else if (lastComma !== -1 || lastDot !== -1) {
        const separator = lastComma !== -1 ? ',' : '.';
        const index = normalized.lastIndexOf(separator);
        const digitsAfter = normalized.length - index - 1;
        if (digitsAfter === 3) {
            normalized = normalized.split(separator).join('');
        } else if (separator === ',') {
            normalized = normalized.replace(',', '.');
        }
    }

    const number = Number(normalized);

    return Number.isFinite(number)
        ? number
        : 0;

}


function formatCOP(amount) {

    return new Intl.NumberFormat(
        'es-CO',
        {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0
        }
    ).format(
        numberValue(amount)
    );

}


function today() {

    return new Date()
        .toISOString()
        .slice(0, 10);

}


function shuffle(array) {

    const result = [
        ...array
    ];

    for (
        let index = result.length - 1;
        index > 0;
        index--
    ) {

        const random =
            Math.floor(
                Math.random() *
                (index + 1)
            );

        [
            result[index],
            result[random]
        ] = [
            result[random],
            result[index]
        ];

    }

    return result;

}


function debounce(
    callback,
    milliseconds
) {

    let timer;

    return (...args) => {

        clearTimeout(timer);

        timer = setTimeout(
            () => callback(...args),
            milliseconds
        );

    };

}


/* ============================================================
   STORAGE
============================================================ */

function readStorage(
    key,
    fallback
) {

    try {

        const raw =
            localStorage.getItem(key);

        return raw
            ? JSON.parse(raw)
            : fallback;

    } catch {

        return fallback;

    }

}


function writeStorage(
    key,
    data
) {

    try {

        localStorage.setItem(
            key,
            JSON.stringify(data)
        );

        return true;

    } catch {

        toast(
            'No fue posible guardar los datos.',
            'error'
        );

        return false;

    }

}


function readSession(
    key,
    fallback
) {

    try {

        const raw =
            sessionStorage.getItem(key);

        return raw
            ? JSON.parse(raw)
            : fallback;

    } catch {

        return fallback;

    }

}


function writeSession(
    key,
    data
) {

    try {

        sessionStorage.setItem(
            key,
            JSON.stringify(data)
        );

        return true;

    } catch {

        return false;

    }

}


function removeSession(
    key
) {

    try {

        sessionStorage.removeItem(
            key
        );

    } catch {

        /* Sin acción */

    }

}


/* ============================================================
   CARGA DE DATOS
============================================================ */

function loadPersistentData() {

    // Las cuentas ahora se autentican con Firebase. No confiar en cuentas locales
    // ni conservar contraseñas antiguas almacenadas en el navegador.
    state.users = [];

    state.classes =
        readStorage(
            APP.storage.classes,
            []
        );

    state.cases =
        readStorage(
            APP.storage.cases,
            []
        );

    state.activities =
        readStorage(
            APP.storage.activities,
            []
        );

    state.enrollments =
        readStorage(
            APP.storage.enrollments,
            []
        );

    state.attempts =
        readStorage(
            APP.storage.attempts,
            []
        );

    state.history =
        readStorage(
            APP.storage.history,
            []
        );

    state.settings = {

        ...state.settings,

        ...readStorage(
            APP.storage.settings,
            {}
        )

    };

}


function savePersistentData() {

    writeStorage(
        APP.storage.users,
        state.users
    );

    writeStorage(
        APP.storage.classes,
        state.classes
    );

    writeStorage(
        APP.storage.cases,
        state.cases
    );

    writeStorage(
        APP.storage.activities,
        state.activities
    );

    writeStorage(
        APP.storage.enrollments,
        state.enrollments
    );

    writeStorage(
        APP.storage.attempts,
        state.attempts
    );

    writeStorage(
        APP.storage.history,
        state.history
    );

    writeStorage(
        APP.storage.settings,
        state.settings
    );

}


/* ============================================================
   XP / PROGRESO
============================================================ */

function getLevelFromXP(xp) {

    let level = 1;

    let name =
        APP.levels[0][0];

    APP.levels.forEach(
        (item, index) => {

            if (
                xp >= item[1]
            ) {

                level =
                    index + 1;

                name =
                    item[0];

            }

        }
    );

    return {
        level,
        name
    };

}


function loadProgress() {

    if (state.guest) {

        state.progress =
            readSession(
                APP.guest.progress,
                {
                    xp: 0,
                    level: 1,
                    completedCases: 0,
                    correctCases: 0,
                    totalAttempts: 0,
                    streak: 0
                }
            );

        return;

    }

    const allProgress =
        readStorage(
            APP.storage.progress,
            {}
        );

    const ownProgress =
        allProgress[
            state.user?.id
        ] || {};

    state.progress = {

        xp: 0,
        level: 1,
        completedCases: 0,
        correctCases: 0,
        totalAttempts: 0,
        streak: 0,

        ...ownProgress

    };

}


function saveProgress() {

    if (!state.user) {

        return;

    }

    if (state.guest) {

        writeSession(
            APP.guest.progress,
            state.progress
        );

        return;

    }

    const allProgress =
        readStorage(
            APP.storage.progress,
            {}
        );

    allProgress[
        state.user.id
    ] = state.progress;

    writeStorage(
        APP.storage.progress,
        allProgress
    );

}


/* ============================================================
   MODALES / TOAST
============================================================ */

function openModal(id) {

    const modal = $(id);

    if (!modal) {

        return;

    }

    modal.classList.remove(
        'hidden'
    );

    modal.setAttribute(
        'aria-hidden',
        'false'
    );

}


function closeModal(id) {

    const modal = $(id);

    if (!modal) {

        return;

    }

    modal.classList.add(
        'hidden'
    );

    modal.setAttribute(
        'aria-hidden',
        'true'
    );

}


function closeAllModals() {

    document
        .querySelectorAll(
            '.modal-overlay'
        )
        .forEach(
            modal => {

                modal.classList.add(
                    'hidden'
                );

            }
        );

}


function toast(
    message,
    type = 'info'
) {

    const container =
        $('toast-container');

    if (!container) {

        return;

    }

    const item =
        document.createElement(
            'div'
        );

    item.className =
        `toast toast-${type}`;

    item.textContent =
        message;

    container.appendChild(
        item
    );

    setTimeout(
        () => item.remove(),
        3600
    );

}


/* ============================================================
   PANTALLAS
============================================================ */

function showEntryScreen() {

    document.body.classList.remove('guest-session');

    hide('app');

    show('entry-screen');

    closeAllModals();

}


function showApplication() {

    document.body.classList.toggle('guest-session', isGuest());

    hide('entry-screen');

    show('app');

}


function isGuest() {

    return state.guest === true;

}


/* ============================================================
   ENTORNO LOCAL / INVITADO
============================================================ */

function getStorageModeLabel() {

    return isGuest()
        ? 'Sesión temporal · sessionStorage'
        : 'Prototipo local · localStorage';

}



/* ============================================================
   SESIÓN REGISTRADA
============================================================ */

function restoreRegisteredSession() {
    // La sesión registrada se restaura desde Firebase Authentication al iniciar.
    return false;
}


/* ============================================================
   SESIÓN INVITADO
============================================================ */

function startGuest(
    mode = 'manual'
) {

    state.guest =
        true;

    state.user = {

        id:
            `GUEST_${generateId('SESSION')}`,

        name:
            'Invitado',

        lastname:
            '',

        role:
            'student'

    };

    state.progress =
        readSession(
            APP.guest.progress,
            {
                xp: 0,
                level: 1,
                completedCases: 0,
                correctCases: 0,
                totalAttempts: 0,
                streak: 0
            }
        );

    state.currentMode =
        mode;

    state.currentCase =
        null;

    state.currentActivity =
        null;

    state.currentActivityCases =
        [];

    state.currentCaseIndex =
        0;

    state.guestState = {

        id:
            state.user.id,

        startedAt:
            new Date().toISOString(),

        mode,

        page:
            mode === 'automatic'
                ? 'automatic-mode'
                : 'manual-mode',

        currentCase:
            null,

        currentActivity:
            null

    };

    showApplication();

    toast(
        'Sesión de invitado iniciada. Elige cómo quieres practicar.',
        'success'
    );

    /*
     * IMPORTANTE:
     * No cargar un caso ni navegar a Liquidación al entrar como invitado.
     * Primero se muestra la pantalla con las opciones Normal y Avanzado.
     * El caso se carga únicamente cuando el usuario pulsa uno de esos botones.
     */
    saveGuestSession();

}


function saveGuestSession() {

    if (!state.guest) {

        return;

    }

    state.guestState = {

        ...(state.guestState || {}),

        id:
            state.user?.id,

        mode:
            state.currentMode,

        page:
            state.page,

        caseIndex:
            state.currentCaseIndex,

        activityId:
            state.currentActivity?.id ||
            null,

        caseId:
            state.currentCase?.id ||
            null,

        currentCase:
            clone(
                state.currentCase
            ),

        currentActivity:
            clone(
                state.currentActivity
            )

    };

    writeSession(
        APP.guest.session,
        state.guestState
    );

    saveProgress();

}


function restoreGuestSession() {

    const guest =
        readSession(
            APP.guest.session,
            null
        );

    if (!guest) {

        return false;

    }

    state.guest =
        true;

    state.user = {

        id:
            guest.id,

        name:
            'Invitado',

        lastname:
            '',

        role:
            'student'

    };

    state.guestState =
        guest;

    state.currentMode =
        guest.mode ||
        'manual';

    state.page =
        guest.page ||
        'billing';

    state.currentCaseIndex =
        guest.caseIndex ||
        0;

    state.currentCase =
        clone(
            guest.currentCase ||
            null
        );

    state.currentActivity =
        clone(
            guest.currentActivity ||
            null
        );

    if (
        state.currentActivity
    ) {

        state.currentActivityCases =
            (
                state.currentActivity.caseIds ||
                []
            )
                .map(
                    getCaseById
                )
                .filter(Boolean);

    }

    loadProgress();

    return true;

}


function exitGuestSession() {

    removeSession(
        APP.guest.session
    );

    removeSession(
        APP.guest.activity
    );

    removeSession(
        APP.guest.progress
    );

    removeSession(
        APP.guest.attempts
    );

    state.guest =
        false;

    state.user =
        null;

    state.currentCase =
        null;

    state.currentActivity =
        null;

    state.currentActivityCases =
        [];

    showEntryScreen();

}


/* ============================================================
   NAVEGACIÓN
============================================================ */

function canAccessPage(
    page
) {

    if (isGuest()) {

        return [
            'dashboard',
            'manual-mode',
            'automatic-mode',
            'billing',
            'test-iss',
            'settings'
        ].includes(page);

    }

    if (!state.user) {

        return false;

    }

    if (
        page.startsWith(
            'teacher-'
        ) ||
        page === 'create-case' ||
        page === 'create-activity'
    ) {

        return (
            state.user.role ===
            'teacher'
        );

    }

    return true;

}


function navigate(
    page
) {

    if (
        !canAccessPage(
            page
        )
    ) {

        toast(
            'No tienes acceso a esta sección.',
            'warning'
        );

        return;

    }

    if (
        !$(`page-${page}`)
    ) {

        console.warn(
            'Página no encontrada:',
            page
        );

        return;

    }

    state.page =
        page;

    renderApplication();

    // Persistir la pantalla actual para que F5 restaure el punto donde iba.
    if (isGuest()) {
        saveGuestSession();
    }

    document
        .querySelector(
            '.sidebar'
        )
        ?.classList.remove(
            'open',
            'mobile-open'
        );

}


function renderApplication() {

    /* ========================================================
       SEGURIDAD DE PÁGINAS
       Ocultamos TODAS las páginas antes de mostrar una sola.
       Esto evita que páginas de profesor/estudiante queden
       visibles por un CSS, estado anterior o sesión restaurada.
    ======================================================== */

    const allPages =
        document.querySelectorAll('.page');

    allPages.forEach(pageElement => {

        pageElement.classList.remove('active-page');

        pageElement.setAttribute('aria-hidden', 'true');

        pageElement.style.setProperty(
            'display',
            'none',
            'important'
        );

    });

    /* Nunca dejamos que un invitado entre a una página
       que pertenece a estudiante/profesor. */
    if (!canAccessPage(state.page)) {

        state.page = 'dashboard';

    }

    const currentPage =
        document.getElementById(`page-${state.page}`);

    if (currentPage) {

        currentPage.classList.add('active-page');

        currentPage.setAttribute('aria-hidden', 'false');

        currentPage.style.setProperty(
            'display',
            'block',
            'important'
        );

    }

    updateCurrentPageName();

    renderSidebar();

    updateHeader();

    const renderers = {

        dashboard:
            renderDashboard,

        'student-activities':
            renderStudentActivities,

        'test-iss':
            () => window.SimuIPSISS?.renderPage(),

        'manual-mode':
            () => renderPracticeMode('manual'),

        'automatic-mode':
            () => renderPracticeMode('automatic'),

        billing:
            renderBillingPage,

        'join-activity':
            renderJoinActivityPage,

        results:
            renderStudentResults,

        'student-progress':
            renderStudentProgress,

        'teacher-classes':
            renderTeacherClasses,

        'teacher-students':
            renderTeacherStudents,

        'teacher-cases':
            renderTeacherCases,

        'create-case':
            renderCaseEditor,

        'teacher-activities':
            renderTeacherActivities,

        'create-activity':
            renderActivityEditor,

        'teacher-results':
            renderTeacherResults,

        'teacher-performance':
            renderTeacherPerformance,

        settings:
            renderSettings

    };

    renderers[state.page]?.();

}


function updateCurrentPageName() {

    const names = {

        dashboard:
            'Inicio',

        'student-activities':
            'Mis actividades',

        'test-iss':
            'Test del ISS',

        'manual-mode':
            'Práctica manual',

        'automatic-mode':
            'Auditoría',

        billing:
            'Liquidación',

        'join-activity':
            'Unirme a actividad',

        results:
            'Resultados',

        'student-progress':
            'Mi progreso',

        'teacher-classes':
            'Mis clases',

        'teacher-students':
            'Mis estudiantes',

        'teacher-cases':
            'Mis casos',

        'create-case':
            'Crear caso',

        'teacher-activities':
            'Mis actividades',

        'create-activity':
            'Crear actividad',

        'teacher-results':
            'Resultados',

        'teacher-performance':
            'Rendimiento',

        settings:
            'Configuración'

    };

    text(
        'current-page-name',
        names[state.page] ||
        'Inicio'
    );

}


/* ============================================================
   SIDEBAR
============================================================ */

function renderSidebar() {

    const nav =
        $('sidebar-nav');

    if (!nav) {

        return;

    }

    if (isGuest()) {

        nav.innerHTML = `

            <button
                class="nav-item"
                data-page="dashboard"
                type="button"
            >
                <span class="nav-icon">⌂</span>
                <span>Inicio</span>
            </button>

            <div class="nav-section-title">
                PRÁCTICA
            </div>

            <button
                class="nav-item"
                data-page="manual-mode"
                type="button"
            >
                <span class="nav-icon">✎</span>
                <span>Práctica manual</span>
            </button>

            <button
                class="nav-item"
                data-page="automatic-mode"
                type="button"
            >
                <span class="nav-icon">✓</span>
                <span>Auditoría</span>
            </button>

            <button
                class="nav-item"
                data-page="test-iss"
                type="button"
            >
                <span class="nav-icon">▤</span>
                <span>Test del ISS</span>
            </button>



            <button


                class="nav-item"


                type="button"


                data-action="download-iss-manual"


            >


                <span class="nav-icon">⇩</span>


                <span>Descargar documento ISS</span>


            </button>

        `;

        text(
            'sidebar-user-name',
            'Invitado'
        );

        text(
            'sidebar-user-role',
            'Sesión temporal'
        );

        text(
            'topbar-user-name',
            'Invitado'
        );

        text(
            'topbar-user-role',
            'Sesión temporal'
        );

        text(
            'sidebar-avatar',
            'I'
        );

        text(
            'topbar-avatar',
            'I'
        );

        /* El invitado sí puede consultar su sesión temporal
           desde Configuración; no tiene acceso a funciones docentes. */
        const guestSettingsButton =
            document.querySelector(
                '.sidebar-bottom [data-page="settings"]'
            );

        if (guestSettingsButton) {
            guestSettingsButton.style.removeProperty('display');
        }

        const guestLogoutButton =
            document.getElementById('logout-button');

        if (guestLogoutButton) {
            const label = guestLogoutButton.querySelector('span:last-child');
            if (label) {
                label.textContent = 'Salir de práctica';
            }
        }

        show('sidebar-login-button');

        return;

    }

    const settingsButton =
        document.querySelector(
            '.sidebar-bottom [data-page="settings"]'
        );

    if (settingsButton) {
        settingsButton.style.removeProperty('display');
    }

    const logoutButton =
        document.getElementById('logout-button');

    if (logoutButton) {
        const label = logoutButton.querySelector('span:last-child');
        if (label) {
            label.textContent = 'Cerrar sesión';
        }
    }

    if (
        state.user?.role ===
        'teacher'
    ) {

        nav.innerHTML = `

            <button
                class="nav-item"
                data-page="dashboard"
                type="button"
            >
                <span class="nav-icon">⌂</span>
                <span>Inicio</span>
            </button>

            <div class="nav-section-title">
                DOCENCIA
            </div>

            <button
                class="nav-item"
                data-page="teacher-classes"
                type="button"
            >
                <span class="nav-icon">◉</span>
                <span>Mis clases</span>
            </button>

            <button
                class="nav-item"
                data-page="teacher-students"
                type="button"
            >
                <span class="nav-icon">♙</span>
                <span>Mis estudiantes</span>
            </button>

            <button
                class="nav-item"
                data-page="teacher-cases"
                type="button"
            >
                <span class="nav-icon">◈</span>
                <span>Mis casos</span>
            </button>

            <button
                class="nav-item"
                data-page="teacher-activities"
                type="button"
            >
                <span class="nav-icon">▣</span>
                <span>Mis actividades</span>
            </button>

            <div class="nav-section-title">
                ANÁLISIS
            </div>

            <button
                class="nav-item"
                data-page="teacher-results"
                type="button"
            >
                <span class="nav-icon">↗</span>
                <span>Resultados</span>
            </button>

            <button
                class="nav-item"
                data-page="teacher-performance"
                type="button"
            >
                <span class="nav-icon">◒</span>
                <span>Rendimiento</span>
            </button>

        `;

        hide(
            'sidebar-login-button'
        );

        return;

    }

    nav.innerHTML = `

        <button
            class="nav-item"
            data-page="dashboard"
            type="button"
        >
            <span class="nav-icon">⌂</span>
            <span>Inicio</span>
        </button>

        <div class="nav-section-title">
            APRENDIZAJE
        </div>

        <button
            class="nav-item"
            data-page="student-activities"
            type="button"
        >
            <span class="nav-icon">▣</span>
            <span>Mis actividades</span>
        </button>

        <button
            class="nav-item"
            data-page="manual-mode"
            type="button"
        >
            <span class="nav-icon">✎</span>
            <span>Práctica manual</span>
        </button>

        <button
            class="nav-item"
            data-page="automatic-mode"
            type="button"
        >
            <span class="nav-icon">✓</span>
            <span>Auditoría</span>
        </button>

        <button
            class="nav-item"
            data-page="test-iss"
            type="button"
        >
            <span class="nav-icon">▤</span>
            <span>Test del ISS</span>
        </button>



        <button


            class="nav-item"


            type="button"


            data-action="download-iss-manual"


        >


            <span class="nav-icon">⇩</span>


            <span>Descargar documento ISS</span>


        </button>

        <div class="nav-section-title">
            PROGRESO
        </div>

        <button
            class="nav-item"
            data-page="results"
            type="button"
        >
            <span class="nav-icon">↗</span>
            <span>Resultados</span>
        </button>

        <button
            class="nav-item"
            data-page="student-progress"
            type="button"
        >
            <span class="nav-icon">★</span>
            <span>Mi progreso</span>
        </button>

    `;

    hide(
        'sidebar-login-button'
    );

}


/* ============================================================
   HEADER
============================================================ */

function updateHeader() {

    if (!state.user) {

        return;

    }

    const fullName =
        `${state.user.name || ''} ${state.user.lastname || ''}`
            .trim() ||
        'Usuario';

    const initials =
        (
            state.user.name?.[0] ||
            ''
        ) +
        (
            state.user.lastname?.[0] ||
            ''
        );

    text(
        'sidebar-user-name',
        fullName
    );

    text(
        'topbar-user-name',
        fullName
    );

    text(
        'sidebar-user-role',
        state.user.role === 'teacher'
            ? 'Profesor'
            : 'Estudiante'
    );

    text(
        'topbar-user-role',
        state.user.role === 'teacher'
            ? 'Profesor'
            : 'Estudiante'
    );

    text(
        'sidebar-avatar',
        initials.toUpperCase() ||
        'U'
    );

    text(
        'topbar-avatar',
        initials.toUpperCase() ||
        'U'
    );

}


/* ============================================================
   AUTENTICACIÓN
============================================================ */

function setupAuthentication() {

    $('login-form')
        ?.addEventListener(
            'submit',
            handleLogin
        );

    $('register-form')
        ?.addEventListener(
            'submit',
            handleRegister
        );

    /* --------------------------------------------------------
       CAMBIO ENTRE LOGIN / REGISTRO
       Soporta los IDs antiguos y los IDs del HTML actual.
    -------------------------------------------------------- */

    [
        'show-register',
        'open-register-from-login'
    ].forEach(id => {

        $(id)?.addEventListener(
            'click',
            () => {

                closeModal('login-modal');
                openModal('register-modal');

            }
        );

    });

    [
        'show-login',
        'open-login-from-register'
    ].forEach(id => {

        $(id)?.addEventListener(
            'click',
            () => {

                closeModal('register-modal');
                openModal('login-modal');

            }
        );

    });

    /* X de los modales: soporta IDs antiguos y data-close-modal */
    $('close-login-modal')?.addEventListener(
        'click',
        () => closeModal('login-modal')
    );

    $('close-register-modal')?.addEventListener(
        'click',
        () => closeModal('register-modal')
    );

    document
        .querySelectorAll('[data-close-modal]')
        .forEach(button => {

            button.addEventListener(
                'click',
                () => closeModal(
                    button.getAttribute('data-close-modal')
                )
            );

        });

    /*
     * Selector compatible con el HTML nuevo y el anterior.
     *
     * HTML nuevo:
     * data-role="student"
     * data-role="teacher"
     *
     * HTML anterior:
     * data-register-role="student"
     * data-register-role="teacher"
     */
    document
        .querySelectorAll(
            '[data-role], [data-register-role]'
        )
        .forEach(
            button => {

                button.addEventListener(
                    'click',
                    () => {

                        setRegisterRole(
                            button.dataset.role ||
                            button.dataset.registerRole ||
                            'student'
                        );

                    }
                );

            }
        );

    document
        .querySelectorAll(
            '.password-toggle'
        )
        .forEach(
            button => {

                button.addEventListener(
                    'click',
                    () => {

                        const input =
                            $(
                                button.dataset.target
                            );

                        if (!input) {

                            return;

                        }

                        input.type =
                            input.type ===
                            'password'
                                ? 'text'
                                : 'password';

                    }
                );

            }
        );

}


function setRegisterRole(
    role
) {

    /*
     * Normalizamos el rol para evitar
     * valores diferentes a student/teacher.
     */
    const normalizedRole =
        role === 'teacher'
            ? 'teacher'
            : 'student';

    if (
        $('register-role')
    ) {

        $('register-role').value =
            normalizedRole;

    }

    /*
     * Compatible con data-role y
     * data-register-role.
     */
    document
        .querySelectorAll(
            '[data-role], [data-register-role]'
        )
        .forEach(
            button => {

                const buttonRole =
                    button.dataset.role ||
                    button.dataset.registerRole;

                button.classList.toggle(
                    'active',
                    buttonRole ===
                    normalizedRole
                );

            }
        );

    toggle(
        'student-register-fields',
        normalizedRole === 'student'
    );

    toggle(
        'teacher-register-fields',
        normalizedRole === 'teacher'
    );

}


async function handleRegister(event) {
    event.preventDefault();

    const name = value('register-first-name') || value('register-name');
    const lastname = value('register-last-name') || value('register-lastname');
    const email = value('register-email').trim().toLowerCase();
    const password = value('register-password');
    const confirmation = value('register-password-confirm');
    const role = value('register-role') || 'student';

    if (!name || !lastname || !email || !password || !confirmation) {
        toast('Completa los campos obligatorios.', 'warning');
        return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        toast('Ingresa un correo válido.', 'warning');
        return;
    }
    if (password.length < 6) {
        toast('La contraseña debe tener mínimo 6 caracteres.', 'warning');
        return;
    }
    if (password !== confirmation) {
        toast('Las contraseñas no coinciden.', 'warning');
        return;
    }

    const profile = {
        name,
        lastname,
        email,
        role: role === 'teacher' ? 'teacher' : 'student',
        institution: value('register-institution'),
        program: value('register-program'),
        teacherArea: value('register-teacher-area'),
        createdAt: new Date().toISOString()
    };

    try {
        await initializeFirebase();
        const credential = await firebaseCreateUser(firebaseAuth, email, password);
        const user = await saveFirebaseUserProfile(credential.user, profile);
        state.users = state.users.filter(item => item.id !== user.id);
        state.users.push(user);
        state.user = user;
        state.guest = false;
        state.currentCase = null;
        state.currentActivity = null;
        state.currentActivityCases = [];
        localStorage.removeItem(APP.storage.session);
        loadProgress();

        const classCode = value('register-class-code').trim().toUpperCase();
        const joinedClass = role === 'student' && classCode
            ? joinClass(classCode, user.id)
            : false;

        // Después del registro siempre se aterriza en Inicio (dashboard),
        // incluso si el usuario venía de un modal o de otra página.
        state.page = 'dashboard';
        closeModal('register-modal');
        closeModal('login-modal');
        showApplication();
        renderApplication();

        if (joinedClass) {
            toast('Cuenta creada y vinculada a la clase.', 'success');
            return;
        }
        toast('Cuenta creada correctamente con Firebase.', 'success');
    } catch (error) {
        console.error('[SimuIPS] Error en el registro Firebase:', error);
        const messages = {
            'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
            'auth/invalid-email': 'El correo no tiene un formato válido.',
            'auth/weak-password': 'La contraseña es demasiado débil.',
            'auth/operation-not-allowed': 'Activa el proveedor Correo/contraseña en Firebase Authentication.',
            'permission-denied': 'Firebase rechazó guardar el perfil. Revisa las reglas de Firestore.'
        };
        toast(messages[error.code] || 'No se pudo crear la cuenta. Revisa la conexión y la configuración de Firebase.', 'error');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const email = value('login-email').trim().toLowerCase();
    const password = value('login-password');
    if (!email || !password) {
        toast('Ingresa correo y contraseña.', 'warning');
        return;
    }

    try {
        await initializeFirebase();
        const credential = await firebaseSignIn(firebaseAuth, email, password);
        const user = await getFirebaseUserProfile(credential.user, { email });
        state.users = state.users.filter(item => item.id !== user.id);
        state.users.push(user);
        state.user = user;
        state.guest = false;
        localStorage.removeItem(APP.storage.session);
        loadProgress();
        closeModal('login-modal');
        showApplication();
        state.page = 'dashboard';
        renderApplication();
        toast(`Bienvenido, ${user.name}.`, 'success');
    } catch (error) {
        console.error('[SimuIPS] Error en el inicio de sesión Firebase:', error);
        const messages = {
            'auth/invalid-credential': 'Correo o contraseña incorrectos.',
            'auth/user-not-found': 'No existe una cuenta con ese correo.',
            'auth/wrong-password': 'Correo o contraseña incorrectos.',
            'auth/invalid-email': 'Ingresa un correo válido.',
            'permission-denied': 'No se pudo leer el perfil en Firestore. Revisa las reglas de seguridad.'
        };
        toast(messages[error.code] || 'No se pudo iniciar sesión. Revisa la conexión y Firebase.', 'error');
    }
}

async function logout() {
    if (isGuest()) {
        openModal('guest-exit-warning-modal');
        return;
    }
    try {
        await initializeFirebase();
        await firebaseSignOut(firebaseAuth);
    } catch (error) {
        console.error('[SimuIPS] Error cerrando sesión Firebase:', error);
        toast('No se pudo cerrar la sesión correctamente.', 'error');
        return;
    }
    localStorage.removeItem(APP.storage.session);
    state.user = null;
    state.currentCase = null;
    state.currentActivity = null;
    showEntryScreen();
}


/* ============================================================
   ENTRADA DE INVITADO
============================================================ */

function setupGuestEntry() {

    $('entry-login-button')
        ?.addEventListener(
            'click',
            () =>
                openModal(
                    'login-modal'
                )
        );

    $('entry-login-link')
        ?.addEventListener(
            'click',
            event => {

                event.preventDefault();

                openModal(
                    'login-modal'
                );

            }
        );

    $('entry-register-button')
        ?.addEventListener(
            'click',
            () =>
                openModal(
                    'register-modal'
                )
        );

    $('entry-guest-button')
        ?.addEventListener('click', () => {
            // Una sesión nueva de invitado siempre empieza en nivel normal.
            // El nivel avanzado se elige explícitamente desde la pantalla de práctica.
            window.SIMUIPS_SELECTED_PRACTICE_LEVEL = 'normal';
            try {
                sessionStorage.setItem('simuips_practice_level', 'normal');
            } catch (_) {}
            startGuest('manual');
            navigate('manual-mode');
        });

    $('entry-activity-button')
        ?.addEventListener(
            'click',
            () => {

                openModal(
                    'guest-activity-modal'
                );

                $('guest-activity-code')
                    ?.focus();

            }
        );

    $('close-guest-practice-modal')
        ?.addEventListener(
            'click',
            () =>
                closeModal(
                    'guest-practice-modal'
                )
        );

    $('close-guest-activity-modal')
        ?.addEventListener(
            'click',
            () =>
                closeModal(
                    'guest-activity-modal'
                )
        );

    $('close-activity-preview')
        ?.addEventListener(
            'click',
            () =>
                closeModal(
                    'activity-preview-modal'
                )
        );

    /* Botón del HTML actual: start-guest-practice.
       Se mantiene confirm-guest-practice por compatibilidad. */
    [
        'confirm-guest-practice',
        'start-guest-practice'
    ].forEach(id => {

        $(id)?.addEventListener(
            'click',
            () => {

                closeModal('guest-practice-modal');
                startGuest('manual');

            }
        );

    });

    $('guest-practice-login')
        ?.addEventListener(
            'click',
            () => {

                closeModal(
                    'guest-practice-modal'
                );

                openModal(
                    'login-modal'
                );

            }
        );

    $('guest-activity-login')
        ?.addEventListener(
            'click',
            () => {

                closeModal(
                    'guest-activity-modal'
                );

                openModal(
                    'login-modal'
                );

            }
        );

    $('activity-preview-login')
        ?.addEventListener(
            'click',
            () => {

                closeModal(
                    'activity-preview-modal'
                );

                openModal(
                    'login-modal'
                );

            }
        );

    $('login-continue-guest')
        ?.addEventListener(
            'click',
            () => {

                closeModal(
                    'login-modal'
                );

                startGuest(
                    'manual'
                );

            }
        );

    $('guest-activity-form')
        ?.addEventListener(
            'submit',
            handleGuestActivityCode
        );

    $('activity-preview-enter')
        ?.addEventListener(
            'click',
            () => {

                if (
                    state.pendingGuestActivityId
                ) {

                    startGuestActivity(
                        state.pendingGuestActivityId
                    );

                }

            }
        );

    $('guest-warning-save-account')
        ?.addEventListener(
            'click',
            () => {

                closeModal(
                    'guest-exit-warning-modal'
                );

                openModal(
                    'register-modal'
                );

            }
        );

    $('guest-warning-continue')
        ?.addEventListener(
            'click',
            () =>
                closeModal(
                    'guest-exit-warning-modal'
                )
        );

    $('guest-warning-exit')
        ?.addEventListener(
            'click',
            () => {

                closeModal(
                    'guest-exit-warning-modal'
                );

                exitGuestSession();

            }
        );

    $('sidebar-login-button')
        ?.addEventListener(
            'click',
            () => {

                if (isGuest()) {

                    openModal(
                        'guest-exit-warning-modal'
                    );

                } else {

                    openModal(
                        'login-modal'
                    );

                }

            }
        );

}


function handleGuestActivityCode(
    event
) {

    event.preventDefault();

    const code =
        value(
            'guest-activity-code'
        )
            .toUpperCase();

    const activity =
        state.activities.find(
            item =>
                String(
                    item.code || ''
                ).toUpperCase() ===
                code
        );

    const error =
        $('guest-activity-error');

    if (!activity) {

        if (error) {

            error.textContent =
                'No se encontró una actividad con ese código.';

            error.classList.remove(
                'hidden'
            );

        }

        return;

    }

    if (
        !activity.guestAccess
    ) {

        if (error) {

            error.textContent =
                'Esta actividad requiere iniciar sesión.';

            error.classList.remove(
                'hidden'
            );

        }

        return;

    }

    if (
        activity.deadline &&
        new Date(
            activity.deadline
        ) < new Date()
    ) {

        if (error) {

            error.textContent =
                'Esta actividad ya venció.';

            error.classList.remove(
                'hidden'
            );

        }

        return;

    }

    state.pendingGuestActivityId =
        activity.id;

    text(
        'activity-preview-name',
        activity.name
    );

    text(
        'activity-preview-description',
        activity.description ||
        'Actividad académica.'
    );

    text(
        'activity-preview-details',
        `${activity.caseIds?.length || 0} caso(s) · ${
            activity.mode === 'evaluation'
                ? 'Evaluación'
                : 'Práctica'
        }`
    );

    text(
        'activity-preview-guest-notice',
        'Puedes ingresar como invitado. Tu resultado será temporal.'
    );

    closeModal(
        'guest-activity-modal'
    );

    openModal(
        'activity-preview-modal'
    );

}


function startGuestActivity(
    activityId
) {

    const activity =
        state.activities.find(
            item =>
                item.id ===
                activityId
        );

    if (!activity) {

        return;

    }

    state.guest =
        true;

    state.user = {

        id:
            `GUEST_${generateId('ACT')}`,

        name:
            'Invitado',

        lastname:
            '',

        role:
            'student'

    };

    state.currentActivity =
        clone(activity);

    state.currentActivityCases =
        (
            activity.caseIds ||
            []
        )
            .map(
                getCaseById
            )
            .filter(Boolean);

    if (
        activity.randomOrder
    ) {

        state.currentActivityCases =
            shuffle(
                state.currentActivityCases
            );

    }

    state.currentCaseIndex =
        0;

    state.currentMode =
        activity.mode ===
        'evaluation'
            ? 'automatic'
            : 'manual';

    state.currentCase =
        clone(
            state.currentActivityCases[0] ||
            null
        );

    state.guestState = {

        id:
            state.user.id,

        startedAt:
            new Date().toISOString(),

        mode:
            state.currentMode,

        page:
            'billing',

        currentCase:
            clone(
                state.currentCase
            ),

        currentActivity:
            clone(
                state.currentActivity
            )

    };

    saveGuestSession();

    closeModal(
        'activity-preview-modal'
    );

    showApplication();

    navigate(
        'billing'
    );

}


/* ============================================================
   NAVEGACIÓN GLOBAL
============================================================ */

function setupNavigation() {

    document.addEventListener(
        'click',
        event => {

            const target =
                event.target.closest(
                    '[data-page], [data-nav-page]'
                );

            if (!target) {

                return;

            }

            event.preventDefault();

            navigate(
                target.dataset.page ||
                target.dataset.navPage
            );

        }
    );

    $('sidebar-toggle')
        ?.addEventListener(
            'click',
            () =>
                document
                    .querySelector(
                        '.sidebar'
                    )
                    ?.classList.toggle(
                        'mobile-open'
                    )
        );

    $('sidebar-close')
        ?.addEventListener(
            'click',
            () =>
                document
                    .querySelector(
                        '.sidebar'
                    )
                    ?.classList.remove(
                        'mobile-open',
                        'open'
                    )
        );

    $('sidebar-overlay')
        ?.addEventListener(
            'click',
            () =>
                document
                    .querySelector(
                        '.sidebar'
                    )
                    ?.classList.remove(
                        'mobile-open',
                        'open'
                    )
        );

    $('user-menu-button')
        ?.addEventListener(
            'click',
            () =>
                $('user-menu-dropdown')
                    ?.classList.toggle(
                        'hidden'
                    )
        );

    // Notificaciones desactivadas: se ocultan el botón y su panel.
    hide('notification-button');
    hide('notification-panel');

    $('user-menu-logout')
        ?.addEventListener(
            'click',
            logout
        );

}


/* ============================================================
   DASHBOARD
============================================================ */

function renderDashboard() {

    /* El invitado también tiene un dashboard propio.
       Antes solo se mostraban los bloques de estudiante/profesor,
       por eso el área central quedaba completamente vacía. */
    toggle(
        'guest-dashboard-content',
        isGuest()
    );

    toggle(
        'student-dashboard-content',
        !isGuest() &&
        state.user?.role ===
        'student'
    );

    toggle(
        'teacher-dashboard-content',
        !isGuest() &&
        state.user?.role ===
        'teacher'
    );

    toggle(
        'professor-dashboard-content',
        !isGuest() &&
        state.user?.role ===
        'teacher'
    );

    const progress =
        state.progress;

    const accuracy =
        progress.totalAttempts > 0
            ? Math.round(
                (
                    progress.correctCases /
                    progress.totalAttempts
                ) *
                100
            )
            : 0;

    text(
        'stat-cases',
        progress.completedCases
    );

    text(
        'stat-accuracy',
        `${accuracy}%`
    );

    text(
        'stat-xp',
        progress.xp
    );

    text(
        'stat-level',
        progress.level
    );

    text(
        'stat-level-label',
        APP.levels[
            progress.level - 1
        ]?.[0] ||
        'Aprendiz'
    );

    const action =
        $('dashboard-primary-action');

    if (!action) {

        return;

    }

    action.textContent =
        isGuest()
            ? '+ Practicar'
            : state.user?.role ===
                'teacher'
                ? '+ Crear actividad'
                : '+ Nuevo ejercicio';

    action.onclick =
        () => {

            if (isGuest()) {

                navigate(
                    'manual-mode'
                );

                return;

            }

            navigate(
                state.user?.role ===
                    'teacher'
                    ? 'create-activity'
                    : 'manual-mode'
            );

        };

}


/* ============================================================
   PRÁCTICA
============================================================ */

function renderPracticeMode(
    mode
) {

    state.currentMode =
        mode;

    if (
        !state.currentCase
    ) {

        startPracticeCase(
            mode
        );

        return;

    }

    renderBillingPage();

}


async function startPracticeCase(
    mode = 'manual'
) {

    state.currentMode = mode;
    state.currentActivity = null;
    state.currentActivityCases = [];
    state.currentCase = null;
    state.currentLiquidation = null;
    state.currentValidation = null;
    state.selectedProcedure = null;
    state.selectedDiagnosis = null;

    const catalog = await loadCatalog('cases');

    let cases = Array.isArray(catalog) ? catalog : [];

    /* Fallback: casos creados localmente por el profesor. */
    if (!cases.length) {
        cases = state.cases.filter(item =>
            item.trainingMode === mode ||
            item.trainingMode === 'both' ||
            !item.trainingMode
        );
    }

    if (!cases.length) {
        showBillingEmpty(true);
        toast(
            'No hay casos locales disponibles. Verifica data/cases.json y abre SimuIPS mediante un servidor local (por ejemplo Live Server).',
            'warning'
        );
        return null;
    }

    state.currentCase = clone(
        cases[Math.floor(Math.random() * cases.length)]
    );

    state.currentCaseIndex = 0;
    state.currentLiquidation = null;
    state.currentValidation = null;
    state.selectedProcedure = null;
    state.selectedDiagnosis = null;

    renderBillingPage();
    saveGuestSession();

    return state.currentCase;
}


/* ============================================================
   BILLING
============================================================ */

function showBillingEmpty(
    visible
) {

    toggle(
        'billing-empty',
        visible
    );

    toggle(
        'billing-exercise',
        !visible
    );

}


function getCaseById(
    id
) {

    return state.cases.find(
        item =>
            item.id === id
    ) || null;

}


function getCode(
    item
) {

    if (!item) {

        return '';

    }

    return String(
        item.code ??
        item.codigo ??
        item.codigoCUPS ??
        item.codigoCIE10 ??
        item.codigoCUM ??
        item.cups ??
        item.cie10 ??
        item.cum ??
        item.iss ??
        ''
    );

}


function getName(
    item
) {

    if (!item) {

        return '';

    }

    return String(
        item.name ??
        item.nombre ??
        item.description ??
        item.descripcion ??
        item.descripcionCUPS ??
        item.descripcionCIE10 ??
        item.detalle ??
        ''
    );

}


function getTariff(
    item
) {

    if (!item) {

        return null;

    }

    return (
        item.value ??
        item.valor ??
        item.tarifa ??
        item.price ??
        item.precio ??
        null
    );

}


function catalogLabel(
    item
) {

    if (!item) {

        return '—';

    }

    const code =
        getCode(item);

    const name =
        getName(item);

    return code
        ? `${code} · ${name}`
        : name ||
            '—';

}


function getDifficultyLabel(
    difficultyValue
) {

    return {

        basic:
            'Básico',

        intermediate:
            'Intermedio',

        advanced:
            'Avanzado'

    }[
        difficultyValue
    ] ||
    difficultyValue ||
    'Básico';

}


function applicableConcepts(
    caseData
) {

    if (
        !Array.isArray(
            caseData?.concepts
        )
    ) {

        return [];

    }

    return caseData.concepts
        .filter(
            concept =>
                concept &&
                concept.applicable !==
                false
        );

}


function renderBillingPage() {

    if (
        !state.currentCase
    ) {

        showBillingEmpty(
            true
        );

        return;

    }

    showBillingEmpty(
        false
    );

    const caseData =
        state.currentCase;

    const patient =
        caseData.patient ||
        caseData.paciente ||
        {};

    text(
        'exercise-number',
        String(
            state.currentCaseIndex + 1
        ).padStart(
            2,
            '0'
        )
    );

    text(
        'exercise-difficulty',
        getDifficultyLabel(
            caseData.difficulty
        )
    );

    text(
        'exercise-name',
        caseData.name ||
        'Caso de práctica'
    );

    text(
        'exercise-title',
        caseData.name ||
        'Caso de práctica'
    );

    text(
        'exercise-description',
        caseData.description ||
        'Realiza la liquidación y valida los conceptos aplicables.'
    );

    text(
        'provided-case-name',
        caseData.name ||
        'Caso'
    );

    text(
        'case-source-badge',
        caseData.procedure?.system ||
        caseData.procedure?.manual ||
        'CATÁLOGO'
    );

    text(
        'billing-patient-name',
        patient.name ||
        patient.nombre ||
        'No informado'
    );

    text(
        'billing-patient-document',
        patient.document ||
        patient.documento ||
        '—'
    );

    text(
        'billing-patient-age',
        patient.age ??
        patient.edad ??
        '—'
    );

    text(
        'billing-patient-sex',
        patient.sex ||
        patient.sexo ||
        '—'
    );

    text(
        'billing-diagnosis',
        catalogLabel(
            caseData.diagnosis ||
            caseData.diagnostico
        )
    );

    text(
        'billing-payer',
        caseData.payer ||
        caseData.payerName ||
        '—'
    );

    text(
        'billing-contract',
        caseData.contract ||
        '—'
    );

    text(
        'billing-date',
        caseData.date ||
        today()
    );

    renderBillingProcedure(
        caseData
    );

    renderBillingRules(
        caseData
    );

    renderBillingConcepts(
        caseData
    );

    setupBillingConceptInputs();

    updateBillingTotals();

    updateBillingMode();

}


/* ============================================================
   PROCEDIMIENTO
============================================================ */

function renderBillingProcedure(
    caseData
) {

    const procedure =
        caseData.procedure ||
        caseData.procedimiento ||
        null;

    const selected =
        state.selectedProcedure ||
        (
            state.currentMode === 'automatic'
                ? procedure
                : null
        );

    if (!procedure && !selected) {

        text(
            'billing-procedure-description',
            'Busca y selecciona el procedimiento correspondiente.'
        );

        text(
            'billing-procedure-reference',
            'Usa el catálogo configurado para el caso.'
        );

        hide('billing-selected-procedure');
        show('billing-procedure-search');

        return;
    }

    text(
        'billing-procedure-description',
        getName(procedure || selected) ||
        'Procedimiento del caso'
    );

    /*
     * En práctica manual el código correcto no se revela.
     * El estudiante debe localizarlo en el catálogo.
     */
    if (state.currentMode === 'manual') {

        text(
            'billing-procedure-reference',
            selected
                ? `Seleccionado: ${getCode(selected) || 'sin código visible'}`
                : 'Identifica y selecciona el código correspondiente en el catálogo.'
        );

        if (selected) {

            text(
                'selected-procedure-name',
                getName(selected)
            );

            text(
                'selected-procedure-code',
                getCode(selected) || '—'
            );

            show('billing-selected-procedure');
            hide('billing-procedure-search');

            const input = $('billing-procedure-input');
            if (input && !input.value) {
                input.value = getCode(selected) || getName(selected) || '';
            }

        } else {

            hide('billing-selected-procedure');
            show('billing-procedure-search');

        }

        return;
    }

    /* Auditoría: mostrar la liquidación generada. */
    const generated = selected || procedure;

    text(
        'billing-procedure-reference',
        getCode(generated) || 'Procedimiento generado'
    );

    text(
        'selected-procedure-name',
        getName(generated) || '—'
    );

    text(
        'selected-procedure-code',
        getCode(generated) || '—'
    );

    show('billing-selected-procedure');
    hide('billing-procedure-search');
}


function renderBillingRules(
    caseData
) {

    const container =
        $('billing-case-rules');

    const card =
        container?.closest('.billing-side-card');

    if (!container) {
        return;
    }

    const rules =
        caseData?.rules ||
        caseData?.reglas ||
        [];

    /*
     * No inventamos reglas. Si el caso no trae reglas explícitas,
     * el bloque completo se oculta para no mostrar información
     * genérica que no necesariamente aplica al ejercicio.
     */
    if (!Array.isArray(rules) || !rules.length) {
        container.innerHTML = "";
        card?.classList.add('hidden');
    } else {
        container.innerHTML =
            rules
                .map(
                    rule =>
                        `<li>${escapeHTML(
                            typeof rule ===
                                'string'
                                ? rule
                                : rule.label ||
                                  rule.description ||
                                  rule.descripcion ||
                                  'Regla'
                        )}</li>`
                )
                .join('');

        card?.classList.remove('hidden');
    }

    updateBillingGuide(caseData);
}

function updateBillingGuide(caseData) {

    const sideCards =
        document.querySelectorAll(
            '.billing-side-column .billing-side-card'
        );

    const guideCard =
        sideCards[0];

    if (!guideCard) {
        return;
    }

    const guideList =
        guideCard.querySelector('.guide-list');

    if (!guideList) {
        return;
    }

    const hasConcepts =
        Array.isArray(caseData?.issSolution?.liquidation)
            ? caseData.issSolution.liquidation.length > 0
            : Object.keys(caseData?.issSolution?.liquidation || {}).length > 0;

    /*
     * Para práctica ISS la presencia de conceptos se determina
     * por los componentes realmente configurados en el caso.
     * No mostramos "Determina los conceptos aplicables" si no hay
     * ningún concepto que liquidar.
     */
    const steps = [
        {
            number: '01',
            text: 'Identifica correctamente el servicio.'
        },
        ...(hasConcepts
            ? [{
                number: '02',
                text: 'Determina los conceptos aplicables.'
            }]
            : []),
        {
            number: hasConcepts ? '03' : '02',
            text: 'Verifica cantidades y valores.'
        },
        {
            number: hasConcepts ? '04' : '03',
            text: 'Comprueba el cálculo final.'
        }
    ];

    guideList.innerHTML = steps
        .map(step => `
            <div>
                <span>${step.number}</span>
                <p>${escapeHTML(step.text)}</p>
            </div>
        `)
        .join('');
}


/* ============================================================
   CONCEPTOS
============================================================ */

function renderBillingConcepts(
    caseData
) {

    const concepts =
        applicableConcepts(
            caseData
        );

    const manual =
        $('manual-concepts');

    const automatic =
        $('automatic-concepts');

    if (manual) {

        manual.innerHTML =
            concepts.length
                ? concepts
                    .map(
                        (
                            concept,
                            index
                        ) =>
                            renderConceptInput(
                                concept,
                                index,
                                false
                            )
                    )
                    .join('')
                :
                    `
                        <div class="empty-state compact">
                            <p>
                                No hay conceptos configurados para este caso.
                            </p>
                        </div>
                    `;

    }

    if (automatic) {

        automatic.innerHTML =
            concepts.length
                ? concepts
                    .map(
                        (
                            concept,
                            index
                        ) =>
                            renderConceptInput(
                                concept,
                                index,
                                true
                            )
                    )
                    .join('')
                :
                    `
                        <div class="empty-state compact">
                            <p>
                                No hay conceptos configurados para este caso.
                            </p>
                        </div>
                    `;

    }

    toggle(
        'manual-concepts-card',
        state.currentMode ===
        'manual'
    );

    toggle(
        'automatic-concepts-card',
        state.currentMode ===
        'automatic'
    );

}


function renderConceptInput(
    concept,
    index,
    readonly
) {

    const key =
        concept.id ||
        concept.key ||
        `concept-${index}`;

    const initialValue =
        readonly
            ? (
                concept.studentValue ??
                concept.correctValue ??
                concept.value ??
                concept.valor ??
                ''
            )
            : (
                concept.studentValue ??
                ''
            );

    return `

        <div
            class="concept-row"
            data-concept-key="${escapeHTML(key)}"
        >

            <div class="concept-main">

                <strong>
                    ${escapeHTML(
                        concept.label ||
                        concept.name ||
                        concept.concepto ||
                        key
                    )}
                </strong>

                <small>
                    ${escapeHTML(
                        concept.unit ||
                        concept.unidad ||
                        ''
                    )}
                </small>

            </div>

            <input
                class="concept-value"
                data-concept-index="${index}"
                type="number"
                step="any"
                value="${escapeHTML(
                    initialValue
                )}"
                ${readonly ? 'readonly' : ''}
            >

        </div>

    `;

}


function setupBillingConceptInputs() {

    document
        .querySelectorAll(
            '#manual-concepts [data-concept-index], #automatic-concepts [data-concept-index]'
        )
        .forEach(input => {

            if (input.dataset.simuipsBillingInputBound) {
                return;
            }

            input.dataset.simuipsBillingInputBound = 'true';

            input.addEventListener(
                'input',
                () => {
                    updateBillingTotals();
                    state.currentValidation = null;
                    hide('billing-validation-card');
                    saveGuestSession();
                }
            );
        });
}


function readBillingAnswers() {

    const container =
        state.currentMode ===
        'manual'
            ? $('manual-concepts')
            : $('automatic-concepts');

    const answers = {};

    container
        ?.querySelectorAll(
            '[data-concept-index]'
        )
        .forEach(
            input => {

                answers[
                    input.dataset.conceptIndex
                ] =
                    numberValue(
                        input.value
                    );

            }
        );

    return answers;

}


function expectedValues(
    caseData
) {

    const concepts =
        applicableConcepts(
            caseData
        );

    const expected = {};

    concepts.forEach(
        (
            concept,
            index
        ) => {

            expected[index] =
                numberValue(
                    concept.correctValue ??
                    concept.value ??
                    concept.valor ??
                    0
                );

        }
    );

    return expected;

}


function calculateTotal(
    values
) {

    return Object
        .values(values)
        .reduce(
            (
                total,
                valueToAdd
            ) =>
                total +
                numberValue(
                    valueToAdd
                ),
            0
        );

}


function updateBillingTotals() {

    const caseData =
        state.currentCase;

    if (!caseData) {

        return;

    }

    const concepts =
        applicableConcepts(
            caseData
        );

    const values = {};

    concepts.forEach(
        (
            concept,
            index
        ) => {

            if (
                state.currentMode ===
                'manual'
            ) {

                values[index] =
                    numberValue(
                        $(
                            'manual-concepts'
                        )
                            ?.querySelector(
                                `[data-concept-index="${index}"]`
                            )
                            ?.value
                    );

            } else {

                values[index] =
                    numberValue(
                        concept.correctValue ??
                        concept.value ??
                        concept.valor ??
                        0
                    );

            }

        }
    );

    const subtotal =
        calculateTotal(
            values
        );

    const adjustments =
        numberValue(
            caseData.adjustments ??
            caseData.ajustes ??
            0
        );

    const copay =
        numberValue(
            caseData.copay ??
            caseData.copago ??
            0
        );

    const total =
        Math.max(
            0,
            subtotal +
            adjustments -
            copay
        );

    text(
        'billing-subtotal',
        formatCOP(
            subtotal
        )
    );

    text(
        'billing-adjustments',
        formatCOP(
            adjustments
        )
    );

    text(
        'billing-copay',
        formatCOP(
            copay
        )
    );

    text(
        'billing-total',
        formatCOP(
            total
        )
    );

}


/* ============================================================
   VALIDACIÓN
============================================================ */

function validateCurrentBilling() {

    const caseData =
        state.currentCase;

    if (!caseData) {

        return;

    }

    const answers =
        readBillingAnswers();

    const expected =
        expectedValues(
            caseData
        );

    const errors = [];

    Object.keys(
        expected
    ).forEach(
        index => {

            const received =
                numberValue(
                    answers[index]
                );

            const expectedValue =
                numberValue(
                    expected[index]
                );

            if (
                Math.abs(
                    received -
                    expectedValue
                ) > 0.01
            ) {

                errors.push({

                    type:
                        'valor',

                    index:
                        Number(index),

                    expected:
                        expectedValue,

                    received

                });

            }

        }
    );

    const procedure =
        caseData.procedure ||
        {};

    const typedCode =
        value(
            'billing-procedure-input'
        );

    const officialCode =
        getCode(procedure);

    const selectedCode =
        getCode(state.selectedProcedure || {});

    if (officialCode) {

        const submittedCode =
            selectedCode ||
            typedCode;

        if (
            !submittedCode ||
            normalize(submittedCode) !==
            normalize(officialCode)
        ) {

            errors.push({

                type:
                    'codigo',

                expected:
                    officialCode,

                received:
                    submittedCode ||
                    'Sin seleccionar'

            });

        }

    }

    const correct =
        errors.length === 0;

    state.currentValidation = {

        correct,

        errors,

        answers

    };

    renderValidationResult(
        correct,
        errors
    );

    updateBillingTotals();

    registerAttempt(
        correct
    );

}


function renderValidationResult(
    correct,
    errors
) {

    show(
        'billing-validation-card'
    );

    const icon =
        $('billing-validation-icon');

    if (icon) {

        icon.textContent =
            correct
                ? '✓'
                : '!';

    }

    text(
        'billing-validation-label',
        correct
            ? 'VALIDADO'
            : 'REVISAR'
    );

    text(
        'billing-validation-title',
        correct
            ? '¡Liquidación correcta!'
            : '¡Fallaste esta liquidación!'
    );

    text(
        'billing-validation-message',
        correct
            ? 'La liquidación es correcta y has ganado experiencia.'
            : 'La liquidación no es correcta. Revisa los campos ingresados e inténtalo nuevamente.'
    );

    const details =
        $('billing-validation-details');

    if (!details) {

        return;

    }

    details.innerHTML =
        errors
            .map(
                error => {

                    if (
                        error.type ===
                        'codigo'
                    ) {

                        return `
                            <li>
                                Procedimiento:
                                ${escapeHTML(
                                    error.received
                                )}
                                · código esperado:
                                ${escapeHTML(
                                    error.expected
                                )}
                            </li>
                        `;

                    }

                    return `
                        <li>
                            Concepto ${error.index + 1}:
                            recibido ${formatCOP(
                                error.received
                            )}
                            · esperado ${formatCOP(
                                error.expected
                            )}
                        </li>
                    `;

                }
            )
            .join('');

}


/* ============================================================
   INTENTOS / XP
============================================================ */

function registerAttempt(
    passed
) {

    const caseData =
        state.currentCase;

    if (!caseData) {

        return;

    }

    const answers =
        readBillingAnswers();

    const errors =
        state.currentValidation
            ?.errors ||
        [];

    const xp =
        passed
            ? 25
            : 0;

    const attempt = {

        id:
            generateId(
                'ATT'
            ),

        studentId:
            state.user?.id ||
            null,

        teacherId:
            caseData.teacherId ||
            null,

        classId:
            state.currentActivity
                ?.classId ||
            null,

        activityId:
            state.currentActivity
                ?.id ||
            null,

        caseId:
            caseData.id ||
            null,

        mode:
            state.currentMode,

        answers,

        errors,

        passed,

        score:
            passed
                ? 100
                : Math.max(
                    0,
                    100 -
                    errors.length *
                    20
                ),

        xp,

        guest:
            isGuest(),

        createdAt:
            new Date().toISOString()

    };

    if (
        isGuest()
    ) {

        const attempts =
            readSession(
                APP.guest.attempts,
                []
            );

        attempts.push(
            attempt
        );

        writeSession(
            APP.guest.attempts,
            attempts
        );

    } else {

        state.attempts.push(
            attempt
        );

        state.history.push(
            attempt
        );

        writeStorage(
            APP.storage.attempts,
            state.attempts
        );

        writeStorage(
            APP.storage.history,
            state.history
        );

    }

    state.progress.totalAttempts += 1;

    state.progress.completedCases += 1;

    if (passed) {

        state.progress.correctCases += 1;

    }

    state.progress.xp +=
        xp;

    state.progress.level =
        getLevelFromXP(
            state.progress.xp
        ).level;

    saveProgress();

    saveGuestSession();

    text(
        'billing-xp-preview',
        passed
            ? `+${xp} XP`
            : '+0 XP'
    );

    if (!(passed && state.currentMode === 'manual')) {
        toast(
            passed
                ? `¡Correcto! +${xp} XP`
                : 'Fallaste la liquidación. Revisa los campos e inténtalo de nuevo.',
            passed
                ? 'success'
                : 'error'
        );
    }

}


/* ============================================================
   SIGUIENTE CASO
============================================================ */

function goToNextCase() {

    if (typeof hideISSSuccessModal === 'function') {
        hideISSSuccessModal();
    }

    if (
        state.currentActivity &&
        state.currentCaseIndex <
            state.currentActivityCases.length -
            1
    ) {

        state.currentCaseIndex +=
            1;

        state.currentCase =
            clone(
                state.currentActivityCases[
                    state.currentCaseIndex
                ]
            );

        state.currentValidation =
            null;

        renderBillingPage();

        saveGuestSession();

        return;

    }

    startPracticeCase(
        state.currentMode
    );

}


/* ============================================================
   MODO BILLING
============================================================ */

function updateBillingMode() {

    document
        .querySelectorAll(
            '[data-billing-mode], .billing-mode-button'
        )
        .forEach(
            button => {

                button.classList.toggle(
                    'active',
                    (
                        button.dataset.billingMode ||
                        button.dataset.mode
                    ) ===
                    state.currentMode
                );

            }
        );

}


function setupBilling() {

    document
        .querySelectorAll(
            '[data-billing-mode], .billing-mode-button'
        )
        .forEach(
            button => {

                button.addEventListener(
                    'click',
                    () => {

                        state.currentMode =
                            button.dataset.billingMode ||
                            button.dataset.mode ||
                            'manual';

                        state.currentValidation =
                            null;

                        if (
                            !state.currentCase
                        ) {

                            startPracticeCase(
                                state.currentMode
                            );

                        } else {

                            renderBillingPage();

                        }

                    }
                );

            }
        );

    $('billing-validate')
        ?.addEventListener(
            'click',
            validateCurrentBilling
        );

    $('billing-next')
        ?.addEventListener(
            'click',
            goToNextCase
        );

    $('billing-save-draft')
        ?.addEventListener(
            'click',
            () => {

                saveGuestSession();

                toast(
                    'Borrador guardado.',
                    'success'
                );

            }
        );

    $('billing-empty-action')
        ?.addEventListener(
            'click',
            () =>
                startPracticeCase(
                    state.currentMode
                )
        );

    $('change-procedure')
        ?.addEventListener(
            'click',
            () => {

                show(
                    'billing-procedure-search'
                );

                hide(
                    'billing-selected-procedure'
                );

            }
        );

    $('billing-procedure-input')
        ?.addEventListener(
            'input',
            debounce(
                async event => {

                    const system =
                        state.currentCase
                            ?.procedure
                            ?.system;

                    const catalog =
                        system === 'ISS'
                            ? 'iss'
                            : 'cups';

                    const results =
                        await searchCatalog(
                            catalog,
                            event.target.value
                        );

                    renderCatalogResults(
                        'billing-procedure-results',
                        results,
                        'procedure'
                    );

                },
                250
            )
        );

}


/* ============================================================
   ACTIVIDADES ESTUDIANTE
============================================================ */

function renderStudentActivities() {

    const container =
        $('student-activities-list');

    if (!container) {

        return;

    }

    const activities =
        state.activities.filter(
            activity =>
                state.enrollments.some(
                    enrollment =>
                        enrollment.activityId ===
                            activity.id &&
                        enrollment.studentId ===
                            state.user?.id
                )
        );

    toggle(
        'student-activities-empty',
        !activities.length
    );

    toggle(
        'join-activity-empty',
        !activities.length
    );

    container.innerHTML =
        activities
            .map(
                activity => `

                    <article
                        class="activity-card"
                    >

                        <span class="card-eyebrow">
                            ACTIVIDAD
                        </span>

                        <h3>
                            ${escapeHTML(
                                activity.name
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                activity.description ||
                                ''
                            )}
                        </p>

                        <div class="activity-card-meta">

                            <span>
                                ${
                                    activity.caseIds
                                        ?.length ||
                                    0
                                }
                                casos
                            </span>

                            <span>
                                ${
                                    activity.mode ===
                                    'evaluation'
                                        ? 'Evaluación'
                                        : 'Práctica'
                                }
                            </span>

                        </div>

                        <button
                            class="primary-button"
                            data-start-activity="${escapeHTML(
                                activity.id
                            )}"
                            type="button"
                        >
                            Comenzar
                        </button>

                    </article>

                `
            )
            .join('');

}


/* ============================================================
   ACTIVIDAD
============================================================ */

function startActivity(
    activityId
) {

    const activity =
        state.activities.find(
            item =>
                item.id ===
                activityId
        );

    if (!activity) {

        toast(
            'No se encontró la actividad.',
            'error'
        );

        return;

    }

    if (
        activity.deadline &&
        new Date(
            activity.deadline
        ) < new Date()
    ) {

        toast(
            'Esta actividad ya venció.',
            'warning'
        );

        return;

    }

    state.currentActivity =
        clone(
            activity
        );

    state.currentActivityCases =
        (
            activity.caseIds ||
            []
        )
            .map(
                getCaseById
            )
            .filter(Boolean);

    if (
        activity.randomOrder
    ) {

        state.currentActivityCases =
            shuffle(
                state.currentActivityCases
            );

    }

    state.currentCaseIndex =
        0;

    state.currentMode =
        activity.mode ===
        'evaluation'
            ? 'automatic'
            : 'manual';

    state.currentCase =
        clone(
            state.currentActivityCases[0] ||
            null
        );

    navigate(
        'billing'
    );

}


function renderJoinActivityPage() {

    const button =
        $('join-activity-submit');

    const input =
        $('activity-code-input');

    if (
        !button ||
        button.dataset.bound
    ) {

        return;

    }

    button.dataset.bound =
        '1';

    button.addEventListener(
        'click',
        () => {

            const code =
                String(
                    input?.value ||
                    ''
                )
                    .trim()
                    .toUpperCase();

            const activity =
                state.activities.find(
                    item =>
                        String(
                            item.code ||
                            ''
                        ).toUpperCase() ===
                        code
                );

            if (!activity) {

                toast(
                    'Actividad no encontrada.',
                    'error'
                );

                return;

            }

            if (
                isGuest()
            ) {

                if (
                    !activity.guestAccess
                ) {

                    toast(
                        'Esta actividad requiere una cuenta.',
                        'warning'
                    );

                    return;

                }

                startGuestActivity(
                    activity.id
                );

                return;

            }

            if (
                state.user?.role !==
                'student'
            ) {

                toast(
                    'Solo los estudiantes pueden ingresar a una actividad.',
                    'warning'
                );

                return;

            }

            joinActivity(
                code
            );

        }
    );

}


function joinActivity(
    code
) {

    const activity =
        state.activities.find(
            item =>
                String(
                    item.code ||
                    ''
                ).toUpperCase() ===
                code
        );

    if (!activity) {

        return;

    }

    const exists =
        state.enrollments.some(
            enrollment =>
                enrollment.activityId ===
                    activity.id &&
                enrollment.studentId ===
                    state.user.id
        );

    if (!exists) {

        state.enrollments.push({

            id:
                generateId(
                    'ENR'
                ),

            activityId:
                activity.id,

            studentId:
                state.user.id,

            joinedAt:
                new Date().toISOString()

        });

        writeStorage(
            APP.storage.enrollments,
            state.enrollments
        );

    }

    toast(
        'Actividad agregada correctamente.',
        'success'
    );

    startActivity(
        activity.id
    );

}


/* ============================================================
   CLASES
============================================================ */

function setupClassFeatures() {

    $('create-class-button')
        ?.addEventListener(
            'click',
            openClassModal
        );

    $('empty-create-class')
        ?.addEventListener(
            'click',
            openClassModal
        );

    $('close-class-modal')
        ?.addEventListener(
            'click',
            () =>
                closeModal(
                    'class-modal'
                )
        );

    $('class-form')
        ?.addEventListener(
            'submit',
            saveClass
        );

}


function openClassModal() {

    $('class-form')
        ?.reset();

    openModal(
        'class-modal'
    );

}


function createClassCode() {

    let code;

    do {

        code =
            `AULA-${Math.random()
                .toString(36)
                .slice(2, 6)
                .toUpperCase()}`;

    } while (
        state.classes.some(
            item =>
                item.code ===
                code
        )
    );

    return code;

}


function saveClass(
    event
) {

    event.preventDefault();

    if (
        state.user?.role !==
        'teacher'
    ) {

        return;

    }

    const name =
        value(
            'class-name'
        );

    if (!name) {

        toast(
            'La clase necesita un nombre.',
            'warning'
        );

        return;

    }

    const classItem = {

        id:
            generateId(
                'CLS'
            ),

        teacherId:
            state.user.id,

        name,

        description:
            value(
                'class-description'
            ),

        code:
            createClassCode(),

        guestAccess:
            $('class-guest-access')
                ?.checked ||
            false,

        studentIds: [],

        createdAt:
            new Date().toISOString()

    };

    state.classes.push(
        classItem
    );

    writeStorage(
        APP.storage.classes,
        state.classes
    );

    closeModal(
        'class-modal'
    );

    renderTeacherClasses();

    toast(
        `Clase creada. Código: ${classItem.code}`,
        'success'
    );

}


function joinClass(
    code,
    studentId
) {

    const normalized =
        String(
            code
        )
            .trim()
            .toUpperCase();

    const classItem =
        state.classes.find(
            item =>
                String(
                    item.code
                ).toUpperCase() ===
                normalized
        );

    if (!classItem) {

        return false;

    }

    if (
        !classItem.studentIds.includes(
            studentId
        )
    ) {

        classItem.studentIds.push(
            studentId
        );

    }

    const already =
        state.enrollments.some(
            enrollment =>
                enrollment.type ===
                    'class' &&
                enrollment.classId ===
                    classItem.id &&
                enrollment.studentId ===
                    studentId
        );

    if (!already) {

        state.enrollments.push({

            id:
                generateId(
                    'CLSENR'
                ),

            type:
                'class',

            classId:
                classItem.id,

            studentId,

            joinedAt:
                new Date().toISOString()

        });

    }

    writeStorage(
        APP.storage.classes,
        state.classes
    );

    writeStorage(
        APP.storage.enrollments,
        state.enrollments
    );

    return true;

}


function renderTeacherClasses() {

    const container =
        $('teacher-classes-list');

    if (!container) {

        return;

    }

    const classes =
        state.classes.filter(
            item =>
                item.teacherId ===
                state.user?.id
        );

    container.innerHTML =
        classes.length
            ? classes
                .map(
                    classItem => `

                        <article
                            class="class-card"
                        >

                            <span class="card-eyebrow">
                                CLASE
                            </span>

                            <h3>
                                ${escapeHTML(
                                    classItem.name
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    classItem.description ||
                                    ''
                                )}
                            </p>

                            <strong>
                                ${escapeHTML(
                                    classItem.code
                                )}
                            </strong>

                            <small>
                                ${
                                    classItem.studentIds
                                        ?.length ||
                                    0
                                }
                                estudiantes
                                · Invitados:
                                ${
                                    classItem.guestAccess
                                        ? 'Sí'
                                        : 'No'
                                }
                            </small>

                            <div class="card-actions">

                                <button
                                    class="secondary-button"
                                    data-copy-code="${escapeHTML(
                                        classItem.code
                                    )}"
                                    type="button"
                                >
                                    Copiar código
                                </button>

                            </div>

                        </article>

                    `
                )
                .join('')
            :
                `
                    <div class="empty-state-card">

                        <h2>
                            No tienes clases creadas
                        </h2>

                        <p>
                            Crea una clase para comenzar.
                        </p>

                    </div>
                `;

}


/* ============================================================
   ESTUDIANTES
============================================================ */

function renderTeacherStudents() {

    const container =
        $('teacher-students-table');

    if (!container) {

        return;

    }

    const search =
        normalize(
            value(
                'teacher-student-search'
            )
        );

    const classId =
        value(
            'teacher-student-class-filter'
        );

    const rows =
        state.enrollments

            .filter(
                enrollment =>
                    enrollment.type ===
                    'class'
            )

            .map(
                enrollment => ({

                    enrollment,

                    user:
                        state.users.find(
                            user =>
                                user.id ===
                                enrollment.studentId
                        ),

                    classItem:
                        state.classes.find(
                            classItem =>
                                classItem.id ===
                                enrollment.classId
                        )

                })
            )

            .filter(
                row =>
                    row.user &&
                    (
                        !classId ||
                        row.enrollment.classId ===
                        classId
                    ) &&
                    (
                        !search ||
                        normalize(
                            `${row.user.name} ${row.user.lastname} ${row.user.email}`
                        ).includes(
                            search
                        )
                    )
            );

    container.innerHTML =
        rows.length
            ? `

                <table>

                    <thead>

                        <tr>

                            <th>
                                Estudiante
                            </th>

                            <th>
                                Correo
                            </th>

                            <th>
                                Clase
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        ${
                            rows
                                .map(
                                    row => `

                                        <tr>

                                            <td>
                                                ${escapeHTML(
                                                    row.user.name
                                                )}
                                                ${escapeHTML(
                                                    row.user.lastname
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHTML(
                                                    row.user.email
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHTML(
                                                    row.classItem
                                                        ?.name ||
                                                    '—'
                                                )}
                                            </td>

                                        </tr>

                                    `
                                )
                                .join('')
                        }

                    </tbody>

                </table>

            `
            :
            `
                <div class="empty-state-card">

                    <p>
                        No hay estudiantes para mostrar.
                    </p>

                </div>
            `;

}


/* ============================================================
   CASOS — PROFESOR
============================================================ */

function setupCaseFeatures() {

    $('create-case-button')
        ?.addEventListener(
            'click',
            openNewCase
        );

    $('empty-create-case')
        ?.addEventListener(
            'click',
            openNewCase
        );

    $('case-form')
        ?.addEventListener(
            'submit',
            saveCase
        );

    $('cancel-case-editor')
        ?.addEventListener(
            'click',
            () =>
                navigate(
                    'teacher-cases'
                )
        );

    $('cancel-case-editor-bottom')
        ?.addEventListener(
            'click',
            () =>
                navigate(
                    'teacher-cases'
                )
        );

    $('case-remove-diagnosis')
        ?.addEventListener(
            'click',
            () => {

                state.selectedDiagnosis =
                    null;

                renderSelectedCatalogs();

            }
        );

    $('case-remove-procedure')
        ?.addEventListener(
            'click',
            () => {

                state.selectedProcedure =
                    null;

                renderSelectedCatalogs();

            }
        );

    $('case-diagnosis-search')
        ?.addEventListener(
            'input',
            debounce(
                async event => {

                    const results =
                        await searchCatalog(
                            'cie10',
                            event.target.value
                        );

                    renderCatalogResults(
                        'case-diagnosis-results',
                        results,
                        'diagnosis'
                    );

                },
                250
            )
        );

    $('case-procedure-search')
        ?.addEventListener(
            'input',
            debounce(
                async event => {

                    const selectedSystem =
                        value(
                            'case-procedure-system'
                        ) ||
                        'cups';

                    const results =
                        await searchCatalog(
                            selectedSystem,
                            event.target.value
                        );

                    renderCatalogResults(
                        'case-procedure-results',
                        results,
                        'procedure'
                    );

                },
                250
            )
        );

}


function openNewCase() {

    state.editingCaseId =
        null;

    state.selectedDiagnosis =
        null;

    state.selectedProcedure =
        null;

    navigate(
        'create-case'
    );

}


function renderTeacherCases() {

    const container =
        $('teacher-cases-list');

    if (!container) {

        return;

    }

    let cases =
        state.cases.filter(
            item =>
                item.teacherId ===
                state.user?.id
        );

    const search =
        normalize(
            value(
                'teacher-case-search'
            )
        );

    if (search) {

        cases =
            cases.filter(
                item =>
                    normalize(
                        item.name
                    ).includes(
                        search
                    )
            );

    }

    const difficulty =
        value(
            'teacher-case-difficulty-filter'
        );

    if (
        difficulty &&
        difficulty !== 'all'
    ) {

        cases =
            cases.filter(
                item =>
                    item.difficulty ===
                    difficulty
            );

    }

    container.innerHTML =
        cases.length
            ? cases
                .map(
                    caseItem => `

                        <article
                            class="case-card"
                        >

                            <span class="card-eyebrow">
                                CASO
                            </span>

                            <h3>
                                ${escapeHTML(
                                    caseItem.name
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    caseItem.description ||
                                    ''
                                )}
                            </p>

                            <div class="case-meta">

                                <span>
                                    ${escapeHTML(
                                        getDifficultyLabel(
                                            caseItem.difficulty
                                        )
                                    )}
                                </span>

                                <span>
                                    ${escapeHTML(
                                        caseItem.procedure
                                            ?.system ||
                                        ''
                                    )}
                                </span>

                            </div>

                            <div class="card-actions">

                                <button
                                    class="secondary-button"
                                    data-edit-case="${escapeHTML(
                                        caseItem.id
                                    )}"
                                    type="button"
                                >
                                    Editar
                                </button>

                                <button
                                    class="danger-button"
                                    data-delete-case="${escapeHTML(
                                        caseItem.id
                                    )}"
                                    type="button"
                                >
                                    Eliminar
                                </button>

                            </div>

                        </article>

                    `
                )
                .join('')
            :
            `
                <div class="empty-state-card">

                    <h2>
                        No tienes casos
                    </h2>

                    <p>
                        Crea tu primer caso reutilizable.
                    </p>

                </div>
            `;

}


function renderCaseEditor() {

    const caseItem =
        state.editingCaseId
            ? getCaseById(
                state.editingCaseId
            )
            : null;

    text(
        'case-editor-title',
        caseItem
            ? 'Editar caso'
            : 'Crear caso'
    );

    setValue(
        'case-id',
        caseItem?.id ||
        ''
    );

    setValue(
        'case-name',
        caseItem?.name ||
        ''
    );

    setValue(
        'case-difficulty',
        caseItem?.difficulty ||
        'basic'
    );

    setValue(
        'case-description',
        caseItem?.description ||
        ''
    );

    const patient =
        caseItem?.patient ||
        {};

    setValue(
        'case-patient-name',
        patient.name ||
        ''
    );

    setValue(
        'case-patient-document',
        patient.document ||
        ''
    );

    setValue(
        'case-patient-age',
        patient.age ??
        ''
    );

    setValue(
        'case-patient-sex',
        patient.sex ||
        ''
    );

    state.selectedDiagnosis =
        clone(
            caseItem?.diagnosis ||
            null
        );

    state.selectedProcedure =
        clone(
            caseItem?.procedure ||
            null
        );

    if (
        $('case-training-mode')
    ) {

        $('case-training-mode').value =
            caseItem?.trainingMode ||
            'manual';

    }

    setValue(
        'case-attempts',
        caseItem?.attempts ??
        1
    );

    if (
        $('case-feedback')
    ) {

        $('case-feedback').checked =
            caseItem?.feedback !==
            false;

    }

    renderSelectedCatalogs();

}


function renderSelectedCatalogs() {

    const diagnosis =
        state.selectedDiagnosis;

    const procedure =
        state.selectedProcedure;

    toggle(
        'case-selected-diagnosis',
        !!diagnosis
    );

    toggle(
        'case-selected-procedure',
        !!procedure
    );

    if (diagnosis) {

        text(
            'case-selected-diagnosis-name',
            getName(
                diagnosis
            )
        );

        text(
            'case-selected-diagnosis-code',
            getCode(
                diagnosis
            )
        );

    }

    if (procedure) {

        text(
            'case-selected-procedure-name',
            getName(
                procedure
            )
        );

        text(
            'case-selected-procedure-code',
            getCode(
                procedure
            )
        );

        text(
            'case-selected-procedure-tariff',
            getTariff(
                procedure
            ) == null
                ? ''
                : formatCOP(
                    getTariff(
                        procedure
                    )
                )
        );

    }

}


function saveCase(
    event
) {

    event.preventDefault();

    if (
        state.user?.role !==
        'teacher'
    ) {

        return;

    }

    const name =
        value(
            'case-name'
        );

    if (!name) {

        toast(
            'El caso necesita un nombre.',
            'warning'
        );

        return;

    }

    if (
        !state.selectedDiagnosis
    ) {

        toast(
            'Selecciona un diagnóstico CIE-10.',
            'warning'
        );

        return;

    }

    if (
        !state.selectedProcedure
    ) {

        toast(
            'Selecciona un procedimiento del catálogo.',
            'warning'
        );

        return;

    }

    const baseCase = {

        name,

        difficulty:
            value(
                'case-difficulty'
            ) ||
            'basic',

        description:
            value(
                'case-description'
            ),

        patient: {

            name:
                value(
                    'case-patient-name'
                ),

            document:
                value(
                    'case-patient-document'
                ),

            age:
                numberValue(
                    value(
                        'case-patient-age'
                    )
                ) ||
                null,

            sex:
                value(
                    'case-patient-sex'
                )

        },

        diagnosis:
            clone(
                state.selectedDiagnosis
            ),

        procedure:
            clone(
                state.selectedProcedure
            ),

        trainingMode:
            value(
                'case-training-mode'
            ) ||
            'manual',

        attempts:
            Number(
                value(
                    'case-attempts'
                )
            ) ||
            1,

        feedback:
            $('case-feedback')
                ?.checked !==
            false,

        updatedAt:
            new Date().toISOString()

    };

    if (
        state.editingCaseId
    ) {

        const index =
            state.cases.findIndex(
                item =>
                    item.id ===
                    state.editingCaseId
            );

        if (
            index >= 0
        ) {

            state.cases[index] = {

                ...state.cases[index],

                ...baseCase

            };

        }

        toast(
            'Caso actualizado.',
            'success'
        );

    } else {

        state.cases.push({

            id:
                generateId(
                    'CASE'
                ),

            teacherId:
                state.user.id,

            ...baseCase,

            createdAt:
                new Date().toISOString()

        });

        toast(
            'Caso creado correctamente.',
            'success'
        );

    }

    writeStorage(
        APP.storage.cases,
        state.cases
    );

    state.editingCaseId =
        null;

    state.selectedDiagnosis =
        null;

    state.selectedProcedure =
        null;

    navigate(
        'teacher-cases'
    );

}


/* ============================================================
   CATÁLOGOS
============================================================ */

async function loadCatalog(
    catalogName
) {

    if (
        state.catalogs[
            catalogName
        ]
    ) {

        return state.catalogs[
            catalogName
        ];

    }

    if (
        state.catalogPromises[
            catalogName
        ]
    ) {

        return state.catalogPromises[
            catalogName
        ];

    }

    const url =
        APP.data[
            catalogName
        ];

    if (!url) {

        return null;

    }

    state.catalogPromises[
        catalogName
    ] =
        fetch(
            url,
            {
                cache:
                    'default'
            }
        )
            .then(
                response => {

                    if (
                        !response.ok
                    ) {

                        throw new Error(
                            `HTTP ${response.status}`
                        );

                    }

                    return response.json();

                }
            )
            .then(
                data => {

                    state.catalogs[
                        catalogName
                    ] =
                        normalizeCatalog(
                            data
                        );

                    return state.catalogs[
                        catalogName
                    ];

                }
            )
            .catch(
                error => {

                    console.warn(
                        `No se pudo cargar ${catalogName}`,
                        error
                    );

                    state.catalogs[
                        catalogName
                    ] =
                        null;

                    return null;

                }
            );

    return state.catalogPromises[
        catalogName
    ];

}


function normalizeCatalog(
    data
) {

    if (
        Array.isArray(
            data
        )
    ) {

        return data;

    }

    for (
        const key of [
            'data',
            'records',
            'results',
            'items'
        ]
    ) {

        if (
            Array.isArray(
                data?.[key]
            )
        ) {

            return data[key];

        }

    }

    return [];

}


async function searchCatalog(
    catalogName,
    query,
    limit = 8
) {

    if (
        !query?.trim()
    ) {

        return [];

    }

    const catalog =
        await loadCatalog(
            catalogName
        );

    if (
        !Array.isArray(
            catalog
        )
    ) {

        return [];

    }

    const normalizedQuery =
        normalize(
            query
        );

    return catalog

        .map(
            item => ({

                item,

                score:
                    scoreCatalogItem(
                        item,
                        normalizedQuery
                    )

            })
        )

        .filter(
            result =>
                result.score >
                0
        )

        .sort(
            (
                first,
                second
            ) =>
                second.score -
                first.score
        )

        .slice(
            0,
            limit
        )

        .map(
            result =>
                result.item
        );

}


function scoreCatalogItem(
    item,
    query
) {

    const code =
        normalize(
            getCode(
                item
            )
        );

    const name =
        normalize(
            getName(
                item
            )
        );

    let score = 0;

    if (
        code === query
    ) {

        score += 100;

    }

    if (
        code.includes(
            query
        )
    ) {

        score += 40;

    }

    if (
        name.includes(
            query
        )
    ) {

        score += 25;

    }

    query
        .split(
            /\s+/
        )
        .forEach(
            word => {

                if (
                    word &&
                    name.includes(
                        word
                    )
                ) {

                    score += 4;

                }

            }
        );

    return score;

}


function renderCatalogResults(
    containerId,
    items,
    type
) {

    const container =
        $(containerId);

    if (!container) {

        return;

    }

    container._catalogItems =
        items;

    if (
        !items.length
    ) {

        container.innerHTML =
            `
                <div class="catalog-empty">
                    No se encontraron resultados.
                </div>
            `;

        return;

    }

    container.innerHTML =
        items
            .map(
                (
                    item,
                    index
                ) => `

                    <button
                        type="button"
                        class="catalog-result"
                        data-catalog-type="${type}"
                        data-catalog-index="${index}"
                    >

                        <strong>
                            ${escapeHTML(
                                getCode(
                                    item
                                ) ||
                                'Sin código'
                            )}
                        </strong>

                        <span>
                            ${escapeHTML(
                                getName(
                                    item
                                ) ||
                                'Sin descripción'
                            )}
                        </span>

                        ${
                            getTariff(
                                item
                            ) != null
                                ? `
                                    <small>
                                        ${formatCOP(
                                            getTariff(
                                                item
                                            )
                                        )}
                                    </small>
                                `
                                : ''
                        }

                    </button>

                `
            )
            .join('');

}


/* ============================================================
   ACTIVIDADES — PROFESOR
============================================================ */

function setupActivityFeatures() {

    $('create-activity-button')
        ?.addEventListener(
            'click',
            openNewActivity
        );

    $('empty-create-activity')
        ?.addEventListener(
            'click',
            openNewActivity
        );

    $('activity-form')
        ?.addEventListener(
            'submit',
            saveActivity
        );

    $('cancel-activity-editor')
        ?.addEventListener(
            'click',
            () =>
                navigate(
                    'teacher-activities'
                )
        );

    $('cancel-activity-editor-bottom')
        ?.addEventListener(
            'click',
            () =>
                navigate(
                    'teacher-activities'
                )
        );

    $('close-activity-code-modal')
        ?.addEventListener(
            'click',
            () =>
                closeModal(
                    'activity-code-modal'
                )
        );

    $('close-generated-code')
        ?.addEventListener(
            'click',
            () =>
                closeModal(
                    'activity-code-modal'
                )
        );

    $('copy-activity-code')
        ?.addEventListener(
            'click',
            copyActivityCode
        );

    $('activity-case-selector')
        ?.addEventListener(
            'change',
            event => {

                if (
                    !event.target.matches(
                        'input[type="checkbox"]'
                    )
                ) {

                    return;

                }

                const id =
                    event.target.value;

                if (
                    event.target.checked
                ) {

                    if (
                        !state.selectedActivityCases.includes(
                            id
                        )
                    ) {

                        state.selectedActivityCases.push(
                            id
                        );

                    }

                } else {

                    state.selectedActivityCases =
                        state.selectedActivityCases.filter(
                            item =>
                                item !==
                                id
                        );

                }

                text(
                    'selected-cases-count',
                    `${state.selectedActivityCases.length} seleccionados`
                );

            }
        );

}


function openNewActivity() {

    state.editingActivityId =
        null;

    state.selectedActivityCases =
        [];

    navigate(
        'create-activity'
    );

}


function createActivityCode() {

    let code;

    do {

        code =
            `C${Math.random()
                .toString(36)
                .slice(2, 6)
                .toUpperCase()}`;

    } while (
        state.activities.some(
            activity =>
                activity.code ===
                code
        )
    );

    return code;

}


function renderTeacherActivities() {

    const container =
        $('teacher-activities-list');

    if (!container) {

        return;

    }

    const activities =
        state.activities.filter(
            activity =>
                activity.teacherId ===
                state.user?.id
        );

    container.innerHTML =
        activities.length
            ? activities
                .map(
                    activity => `

                        <article
                            class="activity-card"
                        >

                            <span class="card-eyebrow">
                                ACTIVIDAD
                            </span>

                            <h3>
                                ${escapeHTML(
                                    activity.name
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    activity.description ||
                                    ''
                                )}
                            </p>

                            <div class="activity-card-meta">

                                <span>
                                    Código:
                                    <strong>
                                        ${escapeHTML(
                                            activity.code
                                        )}
                                    </strong>
                                </span>

                                <span>
                                    ${
                                        activity.caseIds
                                            ?.length ||
                                        0
                                    }
                                    casos
                                </span>

                            </div>

                            <div class="card-actions">

                                <button
                                    class="secondary-button"
                                    data-edit-activity="${escapeHTML(
                                        activity.id
                                    )}"
                                    type="button"
                                >
                                    Editar
                                </button>

                            </div>

                        </article>

                    `
                )
                .join('')
            :
            `
                <div class="empty-state-card">

                    <h2>
                        No tienes actividades
                    </h2>

                    <p>
                        Combina casos para crear una.
                    </p>

                </div>
            `;

}


function renderActivityEditor() {

    const activity =
        state.editingActivityId
            ? state.activities.find(
                item =>
                    item.id ===
                    state.editingActivityId
            )
            : null;

    setValue(
        'activity-id',
        activity?.id ||
        ''
    );

    setValue(
        'activity-name',
        activity?.name ||
        ''
    );

    setValue(
        'activity-description',
        activity?.description ||
        ''
    );

    setValue(
        'activity-mode',
        activity?.mode ||
        'practice'
    );

    setValue(
        'activity-attempts',
        activity?.attempts ??
        1
    );

    setValue(
        'activity-deadline',
        activity?.deadline ||
        ''
    );

    if (
        $('activity-random-order')
    ) {

        $('activity-random-order').checked =
            !!activity?.randomOrder;

    }

    if (
        $('activity-feedback')
    ) {

        $('activity-feedback').checked =
            activity?.feedback !==
            false;

    }

    if (
        $('activity-guest-access')
    ) {

        $('activity-guest-access').checked =
            !!activity?.guestAccess;

    }

    const classSelect =
        $('activity-class');

    if (classSelect) {

        classSelect.innerHTML =
            `
                <option value="">
                    Selecciona una clase
                </option>
            ` +
            state.classes

                .filter(
                    classItem =>
                        classItem.teacherId ===
                        state.user?.id
                )

                .map(
                    classItem => `

                        <option
                            value="${escapeHTML(
                                classItem.id
                            )}"
                        >
                            ${escapeHTML(
                                classItem.name
                            )}
                        </option>

                    `
                )

                .join('');

        classSelect.value =
            activity?.classId ||
            '';

    }

    state.selectedActivityCases =
        activity?.caseIds
            ? [
                ...activity.caseIds
            ]
            : [];

    const selector =
        $('activity-case-selector');

    if (!selector) {

        return;

    }

    const teacherCases =
        state.cases.filter(
            caseItem =>
                caseItem.teacherId ===
                state.user?.id
        );

    selector.innerHTML =
        teacherCases.length
            ? teacherCases
                .map(
                    caseItem => `

                        <label
                            class="case-selector-item"
                        >

                            <input
                                type="checkbox"
                                value="${escapeHTML(
                                    caseItem.id
                                )}"
                                ${
                                    state.selectedActivityCases.includes(
                                        caseItem.id
                                    )
                                        ? 'checked'
                                        : ''
                                }
                            >

                            <span>
                                ${escapeHTML(
                                    caseItem.name
                                )}
                            </span>

                        </label>

                    `
                )
                .join('')
            :
            `
                <div class="empty-state-card">

                    <p>
                        Crea primero un caso.
                    </p>

                </div>
            `;

    text(
        'selected-cases-count',
        `${state.selectedActivityCases.length} seleccionados`
    );

}


function saveActivity(
    event
) {

    event.preventDefault();

    if (
        state.user?.role !==
        'teacher'
    ) {

        return;

    }

    const name =
        value(
            'activity-name'
        );

    const classId =
        value(
            'activity-class'
        );

    if (
        !name ||
        !classId
    ) {

        toast(
            'Completa el nombre y la clase.',
            'warning'
        );

        return;

    }

    if (
        !state.selectedActivityCases.length
    ) {

        toast(
            'Selecciona al menos un caso.',
            'warning'
        );

        return;

    }

    const baseActivity = {

        name,

        classId,

        description:
            value(
                'activity-description'
            ),

        caseIds:
            [
                ...state.selectedActivityCases
            ],

        mode:
            value(
                'activity-mode'
            ) ||
            'practice',

        attempts:
            Number(
                value(
                    'activity-attempts'
                )
            ) ||
            1,

        deadline:
            value(
                'activity-deadline'
            ),

        randomOrder:
            $('activity-random-order')
                ?.checked ||
            false,

        feedback:
            $('activity-feedback')
                ?.checked !==
            false,

        guestAccess:
            $('activity-guest-access')
                ?.checked ||
            false,

        updatedAt:
            new Date().toISOString()

    };

    let savedActivity;

    if (
        state.editingActivityId
    ) {

        const index =
            state.activities.findIndex(
                item =>
                    item.id ===
                    state.editingActivityId
            );

        if (
            index >= 0
        ) {

            state.activities[index] = {

                ...state.activities[index],

                ...baseActivity

            };

            savedActivity =
                state.activities[index];

        }

    } else {

        savedActivity = {

            id:
                generateId(
                    'ACT'
                ),

            teacherId:
                state.user.id,

            code:
                createActivityCode(),

            createdAt:
                new Date().toISOString(),

            ...baseActivity

        };

        state.activities.push(
            savedActivity
        );

    }

    writeStorage(
        APP.storage.activities,
        state.activities
    );

    state.editingActivityId =
        null;

    state.selectedActivityCases =
        [];

    showGeneratedActivityCode(
        savedActivity
    );

    navigate(
        'teacher-activities'
    );

}


function showGeneratedActivityCode(
    activity
) {

    if (!activity) {

        return;

    }

    text(
        'generated-activity-code',
        activity.code
    );

    text(
        'generated-activity-summary',
        `${activity.name} · ${activity.caseIds.length} casos`
    );

    text(
        'generated-activity-guest-status',
        activity.guestAccess
            ? 'Acceso de invitados habilitado'
            : 'Solo usuarios registrados'
    );

    openModal(
        'activity-code-modal'
    );

}


async function copyActivityCode() {

    const code =
        $('generated-activity-code')
            ?.textContent ||
        '';

    if (!code) {

        return;

    }

    try {

        await navigator.clipboard.writeText(
            code
        );

        toast(
            'Código copiado.',
            'success'
        );

    } catch {

        toast(
            'No fue posible copiar el código.',
            'warning'
        );

    }

}


/* ============================================================
   RESULTADOS ESTUDIANTE
============================================================ */

function renderStudentResults() {

    const container =
        $('student-results-table');

    if (!container) {

        return;

    }

    const attempts =
        state.attempts.filter(
            attempt =>
                attempt.studentId ===
                state.user?.id
        );

    const accuracy =
        attempts.length
            ? Math.round(
                (
                    attempts.filter(
                        attempt =>
                            attempt.passed
                    ).length /
                    attempts.length
                ) *
                100
            )
            : 0;

    text(
        'results-total-cases',
        attempts.length
    );

    text(
        'results-accuracy',
        `${accuracy}%`
    );

    text(
        'results-xp',
        attempts.reduce(
            (
                total,
                attempt
            ) =>
                total +
                numberValue(
                    attempt.xp
                ),
            0
        )
    );

    text(
        'results-streak',
        state.progress.streak ||
        0
    );

    container.innerHTML =
        attempts.length
            ? `

                <table>

                    <thead>

                        <tr>

                            <th>
                                Fecha
                            </th>

                            <th>
                                Caso
                            </th>

                            <th>
                                Modo
                            </th>

                            <th>
                                Resultado
                            </th>

                            <th>
                                XP
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        ${
                            attempts
                                .map(
                                    attempt => `

                                        <tr>

                                            <td>
                                                ${new Date(
                                                    attempt.createdAt
                                                ).toLocaleDateString(
                                                    'es-CO'
                                                )}
                                            </td>

                                            <td>
                                                ${escapeHTML(
                                                    getCaseById(
                                                        attempt.caseId
                                                    )?.name ||
                                                    'Caso'
                                                )}
                                            </td>

                                            <td>
                                                ${
                                                    attempt.mode ===
                                                    'automatic'
                                                        ? 'Auditoría'
                                                        : 'Manual'
                                                }
                                            </td>

                                            <td>
                                                ${
                                                    attempt.passed
                                                        ? 'Correcto'
                                                        : 'Revisar'
                                                }
                                            </td>

                                            <td>
                                                +${attempt.xp}
                                            </td>

                                        </tr>

                                    `
                                )
                                .join('')
                        }

                    </tbody>

                </table>

            `
            :
            `
                <div class="empty-state-card">

                    <p>
                        Aún no tienes resultados.
                    </p>

                </div>
            `;

}


/* ============================================================
   PROGRESO
============================================================ */
function renderStudentProgress() {

    const progress =
        state.progress;

    const currentLevel =
        APP.levels[
            progress.level - 1
        ] ||
        APP.levels[0];

    const nextLevel =
        APP.levels[
            progress.level
        ] ||
        currentLevel;

    text(
        'progress-level',
        progress.level
    );

    text(
        'progress-level-name',
        currentLevel[0]
    );

    text(
        'progress-xp-text',
        `${progress.xp} XP`
    );

    text(
        'progress-next-level',
        progress.level <
            APP.levels.length
            ? `${nextLevel[1]} XP`
            : 'Nivel máximo'
    );

    const currentXP =
        Number(progress.xp) || 0;

    const currentLevelXP =
        Number(currentLevel[1]) || 0;

    const nextLevelXP =
        Number(nextLevel[1]) || currentLevelXP;

    let percentage = 100;

    if (
        progress.level <
        APP.levels.length
    ) {

        const levelDifference =
            nextLevelXP -
            currentLevelXP;

        if (
            levelDifference > 0
        ) {

            percentage =
                Math.min(
                    100,
                    Math.max(
                        0,
                        Math.round(
                            (
                                (
                                    currentXP -
                                    currentLevelXP
                                ) /
                                levelDifference
                            ) *
                            100
                        )
                    )
                );

        } else {

            percentage = 0;

        }

    }

    if (
        $('progress-bar-fill')
    ) {

        $('progress-bar-fill')
            .style.width =
            `${percentage}%`;

    }

    text(
        'progress-bar-label',
        `${percentage}%`
    );

}


function renderTeacherPerformance() {

    const activityIds =
        state.activities

            .filter(
                activity =>
                    activity.teacherId ===
                    state.user?.id
            )

            .map(
                activity =>
                    activity.id
            );

    const attempts =
        state.attempts.filter(
            attempt =>
                activityIds.includes(
                    attempt.activityId
                )
        );

    /*
     * ============================================================
     * PRECISIÓN GENERAL
     * ============================================================
     */

    const accuracy =
        attempts.length
            ? Math.round(
                (
                    attempts.filter(
                        attempt =>
                            attempt.passed
                    ).length /
                    attempts.length
                ) *
                100
            )
            : 0;

    text(
        'performance-accuracy',
        `${accuracy}%`
    );


    /*
     * ============================================================
     * ERROR MÁS FRECUENTE
     * ============================================================
     *
     * Antes se tomaba simplemente el primer error encontrado.
     * Ahora contamos cuántas veces aparece cada tipo de error.
     */

    const errorCounts = {};

    attempts.forEach(
        attempt => {

            const errors =
                Array.isArray(
                    attempt.errors
                )
                    ? attempt.errors
                    : [];

            errors.forEach(
                error => {

                    const errorType =
                        error?.type;

                    if (
                        !errorType
                    ) {

                        return;

                    }

                    errorCounts[
                        errorType
                    ] =
                        (
                            errorCounts[
                                errorType
                            ] || 0
                        ) + 1;

                }
            );

        }
    );

    const topError =
        Object.entries(
            errorCounts
        )
            .sort(
                (
                    a,
                    b
                ) =>
                    b[1] -
                    a[1]
            )[0];

    text(
        'performance-top-error',
        topError?.[0] ||
        '—'
    );


    /*
     * ============================================================
     * ACTIVIDAD CON MEJOR RENDIMIENTO
     * ============================================================
     *
     * Antes se mostraba simplemente attempts[0].
     * Ahora agrupamos los intentos por actividad y calculamos
     * el porcentaje de aciertos de cada una.
     */

    const activityStats = {};

    attempts.forEach(
        attempt => {

            const activityId =
                attempt.activityId;

            if (
                !activityId
            ) {

                return;

            }

            if (
                !activityStats[
                    activityId
                ]
            ) {

                activityStats[
                    activityId
                ] = {

                    total: 0,

                    passed: 0

                };

            }

            activityStats[
                activityId
            ].total += 1;

            if (
                attempt.passed
            ) {

                activityStats[
                    activityId
                ].passed += 1;

            }

        }
    );

    const bestActivity =
        Object.entries(
            activityStats
        )
            .map(
                (
                    [
                        activityId,
                        stats
                    ]
                ) => {

                    const percentage =
                        stats.total
                            ? (
                                stats.passed /
                                stats.total
                            ) *
                            100
                            : 0;

                    return {

                        activityId,

                        percentage,

                        total:
                            stats.total

                    };

                }
            )
            .sort(
                (
                    a,
                    b
                ) => {

                    /*
                     * Primero mayor porcentaje.
                     * Si empatan, gana la que tenga
                     * más intentos registrados.
                     */

                    if (
                        b.percentage !==
                        a.percentage
                    ) {

                        return (
                            b.percentage -
                            a.percentage
                        );

                    }

                    return (
                        b.total -
                        a.total
                    );

                }
            )[0];

    const bestActivityName =
        bestActivity
            ? state.activities.find(
                activity =>
                    activity.id ===
                    bestActivity.activityId
            )?.name ||
            '—'
            : '—';

    text(
        'performance-best-activity',
        bestActivityName
    );

}

/* ============================================================
   RESULTADOS PROFESOR
============================================================ */

function renderTeacherResults() {

    const container =
        $('teacher-results-table');

    if (!container) {

        return;

    }

    const activityIds =
        state.activities
            .filter(
                activity =>
                    activity.teacherId ===
                    state.user?.id
            )
            .map(
                activity =>
                    activity.id
            );

    const attempts =
        state.attempts.filter(
            attempt =>
                activityIds.includes(
                    attempt.activityId
                )
        );

    container.innerHTML =
        attempts.length
            ? `

                <table>

                    <thead>

                        <tr>

                            <th>Estudiante</th>
                            <th>Actividad</th>
                            <th>Caso</th>
                            <th>Resultado</th>
                            <th>XP</th>

                        </tr>

                    </thead>

                    <tbody>

                        ${
                            attempts
                                .map(
                                    attempt => {

                                        const user =
                                            state.users.find(
                                                item =>
                                                    item.id ===
                                                    attempt.studentId
                                            );

                                        const activity =
                                            state.activities.find(
                                                item =>
                                                    item.id ===
                                                    attempt.activityId
                                            );

                                        const caseItem =
                                            getCaseById(
                                                attempt.caseId
                                            );

                                        return `

                                            <tr>

                                                <td>
                                                    ${escapeHTML(
                                                        user
                                                            ? `${user.name} ${user.lastname}`
                                                            : attempt.guest
                                                                ? 'Invitado'
                                                                : '—'
                                                    )}
                                                </td>

                                                <td>
                                                    ${escapeHTML(
                                                        activity?.name ||
                                                        '—'
                                                    )}
                                                </td>

                                                <td>
                                                    ${escapeHTML(
                                                        caseItem?.name ||
                                                        '—'
                                                    )}
                                                </td>

                                                <td>
                                                    ${
                                                        attempt.passed
                                                            ? 'Correcto'
                                                            : 'Revisar'
                                                    }
                                                </td>

                                                <td>
                                                    ${numberValue(
                                                        attempt.xp
                                                    )}
                                                </td>

                                            </tr>

                                        `;

                                    }
                                )
                                .join('')
                        }

                    </tbody>

                </table>

            `
            :
            `

                <div class="empty-state-card">

                    <p>
                        Aún no hay resultados.
                    </p>

                </div>

            `;

}


/* ============================================================
   CONFIGURACIÓN
============================================================ */

function setupSettings() {

    $('save-profile-button')
        ?.addEventListener(
            'click',
            saveSettings
        );

    $('guest-save-account-button')
        ?.addEventListener(
            'click',
            () => {
                openModal('register-modal');
            }
        );

    $('clear-guest-session-button')
        ?.addEventListener(
            'click',
            () => {
                if (!isGuest()) return;

                if (confirm('¿Quieres borrar la sesión temporal y salir de la práctica?')) {
                    exitGuestSession();
                }
            }
        );

    [
        ['setting-notifications', 'notifications'],
        ['setting-sound', 'sound'],
        ['setting-feedback', 'feedback']
    ].forEach(([id, key]) => {
        $(id)?.addEventListener('change', event => {
            state.settings[key] = event.target.checked;

            if (isGuest()) {
                writeSession(APP.guest.session, {
                    ...(state.guestState || {}),
                    settings: state.settings
                });
            } else {
                writeStorage(APP.storage.settings, state.settings);
            }
        });
    });

}


function renderSettings() {

    if (!state.user) {

        return;

    }

    const guest = isGuest();

    setValue(
        'settings-name',
        guest ? 'Invitado' : state.user.name
    );

    setValue(
        'settings-lastname',
        guest ? '' : state.user.lastname
    );

    setValue(
        'settings-email',
        guest ? '' : state.user.email
    );

    setValue(
        'settings-institution',
        guest ? '' : state.user.institution
    );

    setValue(
        'settings-program',
        guest ? 'Práctica temporal' : state.user.program
    );

    [
        'settings-name',
        'settings-lastname',
        'settings-email',
        'settings-institution',
        'settings-program'
    ].forEach(id => {
        const field = $(id);
        if (field) field.disabled = guest;
    });

    const saveButton = $('save-profile-button');
    if (saveButton) {
        saveButton.disabled = guest;
        saveButton.textContent = guest
            ? 'Inicia sesión para guardar cambios'
            : 'Guardar cambios';
    }

    const notifications = $('setting-notifications');
    if (notifications) {
        notifications.checked = state.settings.notifications;
    }

    const sound = $('setting-sound');
    if (sound) {
        sound.checked = state.settings.sound;
    }

    const feedback = $('setting-feedback');
    if (feedback) {
        feedback.checked = state.settings.feedback;
    }

    toggle('guest-settings-card', guest);

    const sessionStatus = $('settings-session-status');
    if (sessionStatus) {
        sessionStatus.innerHTML = guest
            ? '<strong>Invitado · sesión temporal</strong><span>Tu práctica se conserva en esta pestaña mientras la sesión temporal siga activa.</span>'
            : '<strong>Cuenta registrada</strong><span>Tu progreso y configuración se guardan en este navegador.</span>';
    }

}


function saveSettings() {

    if (!state.user) {

        return;

    }

    if (isGuest()) {

        toast(
            'Crea una cuenta para guardar cambios de perfil.',
            'info'
        );

        return;

    }

    const email =
        value(
            'settings-email'
        ).toLowerCase();

    if (!email) {

        toast(
            'El correo no puede quedar vacío.',
            'warning'
        );

        return;

    }

    if (
        !/^\S+@\S+\.\S+$/.test(
            email
        )
    ) {

        toast(
            'Ingresa un correo válido.',
            'warning'
        );

        return;

    }

    const emailInUse =
        state.users.some(
            user =>
                user.id !==
                state.user.id &&
                String(
                    user.email
                ).toLowerCase() ===
                email
        );

    if (emailInUse) {

        toast(
            'Ese correo ya pertenece a otra cuenta.',
            'warning'
        );

        return;

    }

    state.user.name =
        value(
            'settings-name'
        );

    state.user.lastname =
        value(
            'settings-lastname'
        );

    state.user.email =
        email;

    state.user.institution =
        value(
            'settings-institution'
        );

    state.user.program =
        value(
            'settings-program'
        );

    const index =
        state.users.findIndex(
            user =>
                user.id ===
                state.user.id
        );

    if (
        index >= 0
    ) {

        state.users[index] = {
            ...state.users[index],
            ...state.user
        };

    }

    state.settings.notifications =
        $('setting-notifications')
            ?.checked !==
        false;

    state.settings.sound =
        $('setting-sound')
            ?.checked !==
        false;

    state.settings.feedback =
        $('setting-feedback')
            ?.checked !==
        false;

    savePersistentData();

    renderApplication();

    toast(
        'Configuración guardada.',
        'success'
    );

}


/* ============================================================
   ENTRENAMIENTO ESTUDIANTE
============================================================ */

function resetPracticeState(
    mode
) {

    state.currentMode =
        mode;

    state.currentActivity =
        null;

    state.currentActivityCases =
        [];

    state.currentCaseIndex =
        0;

    state.currentCase =
        null;

    state.currentLiquidation =
        null;

    state.currentValidation =
        null;

    state.selectedProcedure =
        null;

    state.selectedDiagnosis =
        null;

}


async function startStudentPractice(
    mode = 'manual'
) {

    resetPracticeState(
        mode
    );

    showApplication();

    /*
     * El botón inicia realmente el ejercicio.
     * Antes solo llevaba a la pantalla intermedia y dependía
     * de otro render para disparar la carga del caso.
     */
    await startPracticeCase(mode);

    if (state.currentCase) {
        navigate('billing');
    } else {
        navigate(
            mode === 'automatic'
                ? 'automatic-mode'
                : 'manual-mode'
        );
    }

}


function setupStudentTraining() {

    $('start-manual-practice')
        ?.addEventListener(
            'click',
            () =>
                startStudentPractice(
                    'manual'
                )
        );

    $('start-audit-practice')
        ?.addEventListener(
            'click',
            () =>
                startStudentPractice(
                    'automatic'
                )
        );

    $('start-automatic-practice')
        ?.addEventListener(
            'click',
            () =>
                startStudentPractice(
                    'automatic'
                )
        );

    $('open-join-activity')
        ?.addEventListener(
            'click',
            () =>
                navigate(
                    'join-activity'
                )
        );

    $('empty-join-activity')
        ?.addEventListener(
            'click',
            () =>
                navigate(
                    'join-activity'
                )
        );

}


/* ============================================================
   EVENTOS GLOBALES
============================================================ */

function setupGlobalDelegation() {

    document.addEventListener(
        'click',
        event => {

            const catalogButton =
                event.target.closest(
                    '[data-catalog-type]'
                );

            if (
                catalogButton
            ) {

                const container =
                    catalogButton.parentElement;

                const item =
                    container
                        ?._catalogItems?.[
                            Number(
                                catalogButton.dataset
                                    .catalogIndex
                            )
                        ];

                if (item) {

                    if (
                        catalogButton.dataset
                            .catalogType ===
                        'diagnosis'
                    ) {

                        state.selectedDiagnosis =
                            clone(
                                item
                            );

                    } else {

                        state.selectedProcedure =
                            clone(
                                item
                            );

                    }

                    renderSelectedCatalogs();

                    if (
                        state.currentCase
                    ) {

                        state.currentCase.procedure =
                            clone(
                                state.selectedProcedure
                            );

                    }

                }

                return;

            }


            const editCase =
                event.target.closest(
                    '[data-edit-case]'
                );

            if (
                editCase
            ) {

                state.editingCaseId =
                    editCase.dataset.editCase;

                navigate(
                    'create-case'
                );

                return;

            }


            const deleteCase =
                event.target.closest(
                    '[data-delete-case]'
                );

            if (
                deleteCase
            ) {

                if (
                    !confirm(
                        '¿Eliminar este caso?'
                    )
                ) {

                    return;

                }

                state.cases =
                    state.cases.filter(
                        caseItem =>
                            caseItem.id !==
                            deleteCase.dataset.deleteCase
                    );

                writeStorage(
                    APP.storage.cases,
                    state.cases
                );

                renderTeacherCases();

                toast(
                    'Caso eliminado.',
                    'success'
                );

                return;

            }


            const startActivityButton =
                event.target.closest(
                    '[data-start-activity]'
                );

            if (
                startActivityButton
            ) {

                startActivity(
                    startActivityButton.dataset
                        .startActivity
                );

                return;

            }


            const editActivity =
                event.target.closest(
                    '[data-edit-activity]'
                );

            if (
                editActivity
            ) {

                state.editingActivityId =
                    editActivity.dataset
                        .editActivity;

                navigate(
                    'create-activity'
                );

                return;

            }


            const copyCode =
                event.target.closest(
                    '[data-copy-code]'
                );

            if (
                copyCode
            ) {

                navigator.clipboard
                    ?.writeText(
                        copyCode.dataset
                            .copyCode
                    );

                toast(
                    'Código copiado.',
                    'success'
                );

                return;

            }


            /*
             * RESULTADOS DE BÚSQUEDA GLOBAL
             */

            const searchButton =
                event.target.closest(
                    '[data-search-id]'
                );

            if (
                searchButton
            ) {

                const id =
                    searchButton.dataset
                        .searchId;

                const caseItem =
                    state.cases.find(
                        item =>
                            item.id ===
                            id
                    );

                const activity =
                    state.activities.find(
                        item =>
                            item.id ===
                            id
                    );

                hide(
                    'global-search-results'
                );

                if (
                    caseItem
                ) {

                    if (
                        state.user?.role ===
                        'teacher'
                    ) {

                        state.editingCaseId =
                            caseItem.id;

                        navigate(
                            'create-case'
                        );

                    }

                    return;

                }

                if (
                    activity
                ) {

                    if (
                        state.user?.role ===
                        'teacher'
                    ) {

                        state.editingActivityId =
                            activity.id;

                        navigate(
                            'create-activity'
                        );

                    }

                }

            }

        }
    );

}


/* ============================================================
   BÚSQUEDA GLOBAL
============================================================ */

function setupGlobalSearch() {

    $('global-search')
        ?.addEventListener(
            'input',
            debounce(
                event => {

                    const query =
                        normalize(
                            event.target.value
                        );

                    const container =
                        $('global-search-results');

                    if (
                        !container
                    ) {

                        return;

                    }

                    if (!query) {

                        hide(
                            'global-search-results'
                        );

                        return;

                    }

                    const results =
                        [
                            ...state.cases,
                            ...state.activities
                        ]
                            .filter(
                                item =>
                                    normalize(
                                        item.name
                                    ).includes(
                                        query
                                    )
                            )
                            .slice(
                                0,
                                8
                            );

                    container.innerHTML =
                        results.length
                            ? results
                                .map(
                                    item => `

                                        <button
                                            type="button"
                                            data-search-id="${escapeHTML(
                                                item.id
                                            )}"
                                        >
                                            ${escapeHTML(
                                                item.name
                                            )}
                                        </button>

                                    `
                                )
                                .join('')
                            :
                            `

                                <div class="search-empty">
                                    Sin resultados
                                </div>

                            `;

                    show(
                        'global-search-results'
                    );

                },
                200
            )
        );

}


/* ============================================================
   INICIALIZACIÓN DE FORMULARIOS
============================================================ */

function setupForms() {

    setupClassFeatures();

    setupCaseFeatures();

    setupActivityFeatures();

    setupSettings();

    setupStudentTraining();

    $('teacher-student-search')
        ?.addEventListener(
            'input',
            renderTeacherStudents
        );

    $('teacher-student-class-filter')
        ?.addEventListener(
            'change',
            renderTeacherStudents
        );

    $('teacher-case-search')
        ?.addEventListener(
            'input',
            renderTeacherCases
        );

    $('teacher-case-difficulty-filter')
        ?.addEventListener(
            'change',
            renderTeacherCases
        );

}


/* ============================================================
   LOADING
============================================================ */

function hideLoadingScreen() {

    const loadingScreen =
        document.getElementById(
            'loading-screen'
        );

    if (
        loadingScreen
    ) {

        loadingScreen.classList.add(
            'hidden'
        );

        loadingScreen.setAttribute(
            'aria-hidden',
            'true'
        );

    }

}




/* ============================================================
   SIMUIPS — PARCHE FINAL DE LIQUIDACIÓN
   La pantalla de Liquidación NO permite cambiar Manual/Auditoría.
   El modo queda fijado por el punto de entrada:
     - Práctica manual -> manual
     - Auditoría -> automatic
   La búsqueda/selección del procedimiento, cálculo, validación
   y avance de casos continúan funcionando normalmente.
   ============================================================ */

(function lockBillingModeToEntryPoint() {

    const originalRenderBillingPage =
        renderBillingPage;

    renderBillingPage = function renderBillingPageLocked() {

        originalRenderBillingPage();

        /* Nunca mostrar controles para cambiar el modo dentro
           de la pantalla de liquidación. */
        document
            .querySelectorAll(
                '#page-billing [data-billing-mode], ' +
                '#page-billing .billing-mode-button, ' +
                '#page-billing .billing-mode-selector'
            )
            .forEach(element => {

                element.remove();

            });

        /*
         * Indicador informativo.
         * No es un selector: solo informa cómo se abrió el caso.
         */
        const mode =
            state.currentMode === 'automatic'
                ? 'AUDITORÍA'
                : 'MANUAL';

        const badge =
            document.querySelector(
                '#page-billing .billing-current-mode, ' +
                '#page-billing #billing-current-mode-badge'
            );

        if (badge) {
            badge.textContent =
                mode === 'AUDITORÍA'
                    ? 'Modo auditoría'
                    : 'Liquidación manual';

            badge.setAttribute(
                'aria-label',
                `Modo actual: ${mode.toLowerCase()}`
            );
        }

    };

    /*
     * Si el HTML tiene los botones antes de que se renderice
     * la página, también se eliminan al entrar a Liquidación.
     */
    function removeBillingModeControls() {

        document
            .querySelectorAll(
                '#page-billing [data-billing-mode], ' +
                '#page-billing .billing-mode-button, ' +
                '#page-billing .billing-mode-selector'
            )
            .forEach(element => {
                element.remove();
            });

    }

    const originalNavigate =
        navigate;

    navigate = function navigateWithBillingModeGuard(page) {

        /*
         * IMPORTANTE:
         * aquí NO se cambia state.currentMode.
         * El modo ya fue establecido por:
         * startStudentPractice(), startGuest() o actividad.
         */
        originalNavigate(page);

        if (page === 'billing') {
            removeBillingModeControls();
        }

    };

})();



/* ============================================================
   SIMUIPS — MOTOR DE PRÁCTICA ISS V4
   La liquidación manual se presenta como una tabla tipo
   Manual ISS, adaptada al tipo real de cada caso.

   DIRECTO:
     Código + valor.

   QUIRÚRGICO / UVR:
     Código del procedimiento + UVR.
     Luego: cirujano, anestesiólogo, ayudante, sala y materiales,
     con decisión de aplica/no aplica y campos de liquidación.

   IMPORTANTE:
     La respuesta se obtiene de issSolution del caso para validar.
     Nunca se rellena la respuesta correcta automáticamente.
   ============================================================ */

(function installISSPracticeEngineV4() {

    function issSolution(caseData) {
        return caseData?.issSolution || {};
    }

    function issType(caseData) {
        const solution = issSolution(caseData);
        const declaredType = String(
            solution.tariffType ??
            caseData?.tariffType ??
            caseData?.billingType ??
            caseData?.liquidationType ??
            ''
        ).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

        // La clasificación declarada en el caso tiene prioridad sobre campos auxiliares.
        if (/^(uvr|por uvr|liquidacion uvr)$/.test(declaredType)) return 'uvr';
        if (/^(direct|fixed|fixed tariff|tarifa fija|tarifa directa|pesos|cop)$/.test(declaredType)) return 'direct';

        const liquidation = solution.liquidation || {};
        const hasUVRData =
            solution.uvr !== undefined ||
            caseData?.procedure?.uvr !== undefined ||
            Boolean(
                liquidation.surgeon ||
                liquidation.anesthesiologist ||
                liquidation.assistant ||
                liquidation.room ||
                liquidation.materials
            );

        const hasDirectTariff =
            solution.tariff !== undefined ||
            solution.tariffValue !== undefined ||
            solution.value !== undefined ||
            liquidation.procedure?.unitValue !== undefined ||
            liquidation.service?.unitValue !== undefined;

        if (hasUVRData) return 'uvr';
        if (hasDirectTariff) return 'direct';

        // No se debe clasificar silenciosamente un caso sin datos tarifarios.
        return 'unknown';
    }

    function fieldValue(name) {
        return document.querySelector(
            `#manual-concepts [data-iss-field="${name}"]`
        )?.value?.trim() || '';
    }

    function fieldNumber(name) {
        return numberValue(fieldValue(name));
    }

    function fieldChecked(name) {
        return Boolean(
            document.querySelector(
                `#manual-concepts [data-iss-apply="${name}"]`
            )?.checked
        );
    }

    /*
     * ------------------------------------------------------------
     * VALIDACIÓN VISUAL EN TIEMPO REAL — CÓDIGO ISS
     * Verde = código correcto.
     * Rojo  = código escrito pero incorrecto.
     * Neutro = campo vacío.
     * ------------------------------------------------------------
     */
    function normalizeISSCode(code) {
        return String(code ?? '')
            .trim()
            .replace(/\s+/g, '')
            .toUpperCase();
    }

    function getOfficialProcedureCodes(caseData) {
        const solution = issSolution(caseData);

        return [
            solution.code,
            solution.reference,
            caseData?.procedure?.code,
            caseData?.procedure?.reference
        ]
            .filter(code =>
                code !== undefined &&
                code !== null &&
                String(code).trim() !== ''
            )
            .map(normalizeISSCode)
            .filter(Boolean);
    }

    function setISSFieldVisualState(input, stateName) {
        if (!input) return;

        input.classList.remove(
            'iss-field-valid',
            'iss-field-invalid'
        );

        input.style.transition =
            'border-color 0.15s ease, box-shadow 0.15s ease';

        if (stateName === 'valid') {
            input.classList.add('iss-field-valid');
            input.style.borderColor = '#16a34a';
            input.style.boxShadow =
                '0 0 0 2px rgba(22, 163, 74, 0.14)';
        } else if (stateName === 'invalid') {
            input.classList.add('iss-field-invalid');
            input.style.borderColor = '#dc2626';
            input.style.boxShadow =
                '0 0 0 2px rgba(220, 38, 38, 0.14)';
        } else {
            input.style.borderColor = '';
            input.style.boxShadow = '';
        }
    }

    function updateISSProcedureCodeVisualState(caseData) {
        const input =
            document.querySelector(
                '#manual-concepts [data-iss-field="procedure-code"]'
            );

        if (!input) return;

        const entered = normalizeISSCode(input.value);

        if (!entered) {
            setISSFieldVisualState(input, 'neutral');
            return;
        }

        const officialCodes =
            getOfficialProcedureCodes(caseData);

        setISSFieldVisualState(
            input,
            officialCodes.includes(entered)
                ? 'valid'
                : 'invalid'
        );
    }


    function setHiddenProcedureCode(code) {
        const input = $('billing-procedure-input');

        if (input) {
            input.value = code || '';
        }
    }


    function updateISSPracticeFieldVisualStates(caseData) {
        const container = $('manual-concepts');
        if (!container || !caseData) return;

        const solution = issSolution(caseData);
        const type = issType(caseData);
        const getInput = name => container.querySelector(`[data-iss-field="${name}"]`);
        const mark = (name, expected, normalizer = value => String(value).trim()) => {
            const input = getInput(name);
            if (!input) return;
            const entered = String(input.value ?? '').trim();
            if (!entered) {
                setISSFieldVisualState(input, 'neutral');
                return;
            }
            if (expected === undefined || expected === null || expected === '') {
                setISSFieldVisualState(input, 'neutral');
                return;
            }
            setISSFieldVisualState(
                input,
                normalizer(entered) === normalizer(expected) ? 'valid' : 'invalid'
            );
        };
        const numberNorm = value => {
            const n = Number(String(value).replace(/[,$\s.]/g, ''));
            return Number.isFinite(n) ? String(n) : String(value).trim();
        };

        const roomUVRDisplay = container.querySelector('[data-iss-room-uvr]');
        if (roomUVRDisplay) {
            const procedureUVR = String(getInput('procedure-uvr')?.value || '').trim();
            roomUVRDisplay.textContent = procedureUVR || 'UVR del procedimiento';
        }

        const codeInput = getInput('procedure-code');
        if (codeInput) {
            const entered = normalizeISSCode(codeInput.value);
            if (!entered) {
                setISSFieldVisualState(codeInput, 'neutral');
            } else {
                const official = getOfficialProcedureCodes(caseData);
                setISSFieldVisualState(codeInput, official.length
                    ? (official.includes(entered) ? 'valid' : 'invalid')
                    : 'neutral');
            }
        }

        if (type === 'direct') {
            mark('procedure-value', solution.tariff ?? solution.value ?? solution.tariffValue, numberNorm);
            return;
        }

        mark('procedure-uvr', solution.uvr, numberNorm);

        componentRows(solution).forEach(row => {
            const data = row.data || {};
            const formulaRoom = row.key === 'room' &&
                data.factor !== undefined &&
                !String(data.code || data.reference || '').trim();

            if (!formulaRoom) {
                mark(`${row.key}-code`, data.reference ?? data.code, value =>
                    normalizeISSCode(value));
            }

            if (data.factor !== undefined) {
                mark(`${row.key}-uvr`, solution.uvr, numberNorm);
                mark(`${row.key}-factor`, data.factor, numberNorm);
            } else if (data.value !== undefined) {
                mark(`${row.key}-value`, data.value, numberNorm);
            }

            const apply = container.querySelector(`[data-iss-apply="${row.key}"]`);
            if (apply && Object.prototype.hasOwnProperty.call(data, 'applicable')) {
                const label = apply.closest('label');
                if (label) {
                    label.classList.remove('iss-field-valid', 'iss-field-invalid');
                    const expected = data.applicable === true;
                    const actual = apply.checked;
                    if (actual === expected) label.classList.add('iss-field-valid');
                    else label.classList.add('iss-field-invalid');
                }
            }
        });
    }

    function syncPracticeInputs() {

        const container = $('manual-concepts');

        if (!container) {
            return;
        }

        container
            .querySelectorAll(
                '[data-iss-field], [data-iss-apply]'
            )
            .forEach(element => {

                if (element.dataset.simuipsIssBound) {
                    return;
                }

                element.dataset.simuipsIssBound = 'true';

                element.addEventListener(
                    'input',
                    () => {

                        if (
                            element.dataset.issField ===
                            'procedure-code'
                        ) {
                            setHiddenProcedureCode(
                                element.value.trim()
                            );

                            updateISSProcedureCodeVisualState(
                                state.currentCase
                            );
                        }

                        state.currentValidation = null;
                        hide('billing-validation-card');

                        if (
                            element.dataset.issField !==
                            'procedure-code'
                        ) {
                            element.classList.remove(
                                'iss-invalid'
                            );
                        }

                        updateBillingTotals();
                        updateISSPracticeFieldVisualStates(state.currentCase);
                        saveGuestSession();
                    }
                );

                element.addEventListener(
                    'change',
                    () => {

                        if (
                            element.dataset.issField ===
                            'procedure-code'
                        ) {
                            updateISSProcedureCodeVisualState(
                                state.currentCase
                            );
                        }

                        state.currentValidation = null;
                        hide('billing-validation-card');

                        updateBillingTotals();
                        updateISSPracticeFieldVisualStates(state.currentCase);
                        saveGuestSession();
                    }
                );

            });

        updateISSProcedureCodeVisualState(
            state.currentCase
        );
    }

    function renderPracticeProcedureHeader(caseData) {

        const procedure =
            caseData?.procedure || {};

        const description =
            caseData?.issSolution?.description ||
            procedure.name ||
            procedure.description ||
            'Procedimiento ISS';

        text(
            'billing-procedure-description',
            description
        );

        text(
            'billing-procedure-reference',
            'Consulta el Manual ISS e identifica el código del procedimiento.'
        );

        hide('billing-selected-procedure');

        /*
         * En práctica ISS el código se solicita UNA SOLA VEZ,
         * dentro de la tabla de liquidación. El bloque superior
         * antiguo también tenía un campo de código y provocaba
         * que el estudiante tuviera que escribirlo dos veces.
         *
         * Se conserva el contenedor por compatibilidad con el HTML
         * existente, pero se deja completamente oculto y vacío.
         */
        const search = $('billing-procedure-search');

        if (search) {
            search.innerHTML = '';
            search.classList.add('hidden');
        }

        setHiddenProcedureCode('');
    }

    function componentRows(solution) {

        const liquidation =
            solution.liquidation || {};

        return [
            ['surgeon', 'Cirujano'],
            ['anesthesiologist', 'Anestesiólogo'],
            ['assistant', 'Ayudante quirúrgico'],
            ['room', 'Derechos de sala'],
            ['materials', 'Materiales']
        ]
            .filter(
                ([key]) =>
                    liquidation[key]
            )
            .map(
                ([key, label]) => ({
                    key,
                    label,
                    data: liquidation[key]
                })
            );
    }

    function componentInput(
        key,
        name,
        valueToSet = '',
        type = 'text'
    ) {

        return `
            <input
                class="iss-table-input"
                type="${type}"
                ${type === 'number' ? 'step="any"' : ''}
                data-iss-field="${escapeHTML(name)}"
                placeholder="${escapeHTML(
                    type === 'number'
                        ? 'Ingresar'
                        : 'Código'
                )}"
                value="${escapeHTML(valueToSet)}"
                autocomplete="off"
            >
        `;
    }

    function renderDirectTable(caseData) {

        const solution =
            issSolution(caseData);

        const description =
            solution.description ||
            caseData.procedure?.name ||
            'Servicio';

        const tariff =
            solution.tariff ??
            solution.liquidation?.procedure?.unitValue ??
            solution.liquidation?.service?.unitValue ??
            0;

        return `
            <div class="iss-practice-intro">
                <div>
                    <span class="card-eyebrow">
                        TARIFA DIRECTA
                    </span>

                    <strong>
                        Identifica el código y determina la tarifa.
                    </strong>
                </div>

                <span class="iss-practice-hint">
                    Este caso no requiere UVR ni honorarios quirúrgicos.
                </span>
            </div>

            <div class="iss-table-wrap">

                <table class="iss-liquidation-table iss-table-direct">

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>UVR</th>
                            <th>Valor unitario</th>
                            <th>Valor total</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr>

                            <td>
                                ${componentInput(
                                    'procedure-code',
                                    'procedure-code'
                                )}
                            </td>

                            <td>
                                <div class="iss-description-cell">
                                    ${escapeHTML(description)}
                                </div>
                            </td>

                            <td class="iss-dash">
                                —
                            </td>

                            <td>
                                ${componentInput(
                                    'procedure-value',
                                    'procedure-value',
                                    '',
                                    'number'
                                )}
                            </td>

                            <td>
                                <output
                                    class="iss-total-output"
                                    data-iss-output="procedure-total"
                                >
                                    $0
                                </output>
                            </td>

                        </tr>
                    </tbody>

                </table>

            </div>
        `;
    }

    function renderUVRTable(caseData) {

        const solution = issSolution(caseData);
        const rows = componentRows(solution);
        const procedureDescription =
            solution.description ||
            caseData.procedure?.name ||
            'Procedimiento';

        return `
            <div class="iss-practice-intro">
                <div>
                    <span class="card-eyebrow">LIQUIDACIÓN POR UVR</span>
                    <strong>Identifica el procedimiento y sus componentes.</strong>
                </div>
                <span class="iss-practice-hint">Marca los conceptos aplicables e ingresa las UVR.</span>
            </div>

            <div class="iss-procedure-mini-table">
                <div class="iss-mini-title">Procedimiento</div>
                <div class="iss-mini-grid">
                    <div>
                        <span>Código</span>
                        ${componentInput('procedure-code', 'procedure-code')}
                    </div>
                    <div class="iss-description-cell">
                        <span>Descripción</span>
                        <strong>${escapeHTML(procedureDescription)}</strong>
                    </div>
                    <div>
                        <span>UVR del procedimiento</span>
                        ${componentInput('procedure-uvr', 'procedure-uvr', '', 'number')}
                    </div>
                </div>
            </div>

            ${rows.length ? `
                <div class="iss-table-wrap">
                    <table class="iss-liquidation-table iss-table-uvr">
                        <thead>
                            <tr>
                                <th>Aplica</th>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th>Tarifa por UVR</th>
                                <th>Valor total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(row => {
                                const data = row.data || {};
                                const hasFactor = data.factor !== undefined;
                                return `
                                    <tr data-iss-component="${escapeHTML(row.key)}">
                                        <td>
                                            <label class="iss-apply-control">
                                                <input type="checkbox" data-iss-apply="${escapeHTML(row.key)}">
                                                <span>Sí</span>
                                            </label>
                                        </td>
                                        <td>
                                            ${componentInput(row.key, `${row.key}-code`)}
                                        </td>
                                        <td>
                                            <div class="iss-description-cell">
                                                <strong>${escapeHTML(data.label || row.label)}</strong>
                                                <div class="iss-component-help">
                                                    ${escapeHTML(({
                                                        surgeon: 'Honorarios del cirujano especialista. Ingresa la tarifa por cada UVR del procedimiento.',
                                                        anesthesiologist: 'Honorarios de anestesiología, si el servicio fue prestado. Ingresa la tarifa por cada UVR.',
                                                        assistant: 'La ayudantía solo se reconoce si se prestó y cumple las condiciones del Manual ISS.',
                                                        room: 'Derechos de sala: ingresa la tarifa por UVR aplicable al rango y escenario.',
                                                        materials: 'Materiales de sutura y curación, cuando correspondan según las reglas del caso.'
                                                    })[row.key] || row.label)}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            ${hasFactor
                                                ? componentInput(
                                                    row.key,
                                                    `${row.key}-uvr`,
                                                    '',
                                                    'number'
                                                )
                                                : '<span class="iss-dash">—</span>'}
                                        </td>
                                        <td>
                                            ${hasFactor
                                                ? `<output class="iss-total-output" data-iss-output="${escapeHTML(row.key)}-total">$0</output>`
                                                : componentInput(row.key, `${row.key}-value`, '', 'number')}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}

            ${(caseData.rules || caseData.reglas || []).length ? `
                <div class="iss-rules-note">
                    <strong>Reglas que debes aplicar</strong>
                    <ul>${(caseData.rules || caseData.reglas || []).map(rule => `<li>${escapeHTML(rule)}</li>`).join('')}</ul>
                </div>
            ` : ''}
        `;
    }

    function renderISSPracticeTable(caseData) {

        const container =
            $('manual-concepts');

        if (!container) {
            return;
        }

        const type =
            issType(caseData);

        container.classList.add(
            'iss-practice-container'
        );

        container.innerHTML =
            type === 'direct'
                ? renderDirectTable(caseData)
                : renderUVRTable(caseData);

        hide('add-manual-concept');

        document
            .querySelectorAll('#page-billing button, #page-billing [role="button"], #manual-concepts button')
            .forEach(element => {
                if (/agregar concepto/i.test((element.textContent || '').trim())) {
                    element.style.setProperty('display', 'none', 'important');
                }
            });

        container
            .querySelectorAll(
                '[data-iss-field]'
            )
            .forEach(input => {
                setISSFieldVisualState(
                    input,
                    'neutral'
                );
            });

        syncPracticeInputs();
        updateISSPracticeFieldVisualStates(caseData);

        updateISSPracticeTotal(caseData);
    }

    function updateISSPracticeTotal(caseData) {

        const container =
            $('manual-concepts');

        if (!container) {
            return;
        }

        const type =
            issType(caseData);

        let total = 0;

        if (type === 'direct') {

            const valueEntered =
                fieldNumber(
                    'procedure-value'
                );

            total =
                valueEntered;

            const output =
                container.querySelector(
                    '[data-iss-output="procedure-total"]'
                );

            if (output) {
                output.textContent =
                    formatCOP(total);
            }

        } else {

            const solution =
                issSolution(caseData);

            const rows =
                componentRows(solution);

            rows.forEach(
                row => {

                    if (
                        !fieldChecked(row.key)
                    ) {
                        return;
                    }

                    const data =
                        row.data || {};

                    if (
                        data.factor !== undefined
                    ) {

                        // El estudiante ingresa la tarifa por UVR (p. ej. $1.270).
                        // Las UVR del procedimiento se ingresan una sola vez arriba (p. ej. 510).
                        // Total del concepto = UVR del procedimiento × tarifa por UVR ingresada.
                        const factorEntered =
                            fieldNumber(`${row.key}-uvr`);

                        const procedureUVR =
                            fieldNumber('procedure-uvr');

                        const valueCalculated =
                            procedureUVR * factorEntered;

                        total +=
                            valueCalculated;

                        const output =
                            container.querySelector(
                                `[data-iss-output="${row.key}-total"]`
                            );

                        if (output) {
                            output.textContent =
                                formatCOP(
                                    valueCalculated
                                );
                        }

                    } else {

                        total +=
                            fieldNumber(
                                `${row.key}-value`
                            );

                    }

                }
            );

        }

        text(
            'billing-subtotal',
            formatCOP(total)
        );

        text(
            'billing-adjustments',
            formatCOP(
                numberValue(
                    caseData.adjustments ??
                    caseData.ajustes ??
                    0
                )
            )
        );

        text(
            'billing-copay',
            formatCOP(
                numberValue(
                    caseData.copay ??
                    caseData.copago ??
                    0
                )
            )
        );

        text(
            'billing-total',
            formatCOP(
                Math.max(
                    0,
                    total +
                    numberValue(
                        caseData.adjustments ??
                        caseData.ajustes ??
                        0
                    ) -
                    numberValue(
                        caseData.copay ??
                        caseData.copago ??
                        0
                    )
                )
            )
        );

        const result =
            caseData?.issSolution?.result;

        const finalNote =
            document.querySelector(
                '#page-billing [data-iss-final-note]'
            );

        if (finalNote && result) {

            finalNote.textContent =
                result.complete
                    ? 'Resultado completo configurado para validación.'
                    : 'El valor final depende del consumo de materiales según el Artículo 85.';
        }
    }

    function validRangeCode(code, min, max) {

        const number =
            Number(
                String(code)
                    .replace(/\D/g, '')
            );

        return (
            Number.isFinite(number) &&
            number >= min &&
            number <= max
        );
    }

    function validateISSPractice(caseData) {

        const solution =
            issSolution(caseData);

        const type =
            issType(caseData);

        const errors = [];

        const procedureCode =
            fieldValue('procedure-code');

        const officialProcedureCodes =
            getOfficialProcedureCodes(caseData);

        /*
         * Algunos registros del Capítulo II, Artículo 19 del PDF
         * suministrado muestran la tarifa y el nombre del examen,
         * pero no permiten verificar un código completo. En esos
         * casos no se exige ni se inventa un código: se valida la
         * tarifa directa. Cuando el Manual sí aporta código, se
         * conserva la validación normal.
         */
        if (officialProcedureCodes.length > 0) {

            if (!procedureCode) {

                errors.push({
                    type: 'codigo',
                    label: 'Código del procedimiento',
                    received: 'Sin ingresar'
                });

            } else if (
                !officialProcedureCodes.includes(
                    normalizeISSCode(procedureCode)
                )
            ) {

                errors.push({
                    type: 'codigo',
                    label: 'Código del procedimiento',
                    expected: [solution.code, solution.reference]
                        .filter(code => code !== undefined && code !== null && String(code).trim() !== '')
                        .join(' / '),
                    received: procedureCode
                });

            }
        }

        if (type === 'direct') {

            const enteredValue =
                fieldValue('procedure-value');

            if (!enteredValue) {

                errors.push({
                    type: 'valor',
                    label: 'Valor del servicio',
                    received: 'Sin ingresar'
                });

            } else if (
                Math.abs(
                    fieldNumber('procedure-value') -
                    numberValue(solution.tariff)
                ) > 0.01
            ) {

                errors.push({
                    type: 'valor',
                    label: 'Valor del servicio',
                    received: formatCOP(
                        fieldNumber('procedure-value')
                    )
                });

            }

        } else {

            const enteredUVR =
                fieldValue('procedure-uvr');

            if (!enteredUVR) {

                errors.push({
                    type: 'uvr',
                    label: 'UVR del procedimiento',
                    received: 'Sin ingresar'
                });

            } else if (
                Math.abs(
                    fieldNumber('procedure-uvr') -
                    numberValue(solution.uvr)
                ) > 0.01
            ) {

                errors.push({
                    type: 'uvr',
                    label: 'UVR del procedimiento',
                    received: fieldNumber('procedure-uvr')
                });

            }

            componentRows(solution)
                .forEach(
                    row => {

                        const data =
                            row.data || {};

                        const applies =
                            fieldChecked(
                                row.key
                            );

                        const hasApplicabilityRule =
                            Object.prototype.hasOwnProperty.call(data, 'applicable');

                        if (hasApplicabilityRule && applies !== data.applicable) {
                            errors.push({
                                type: 'aplicabilidad',
                                label: row.label,
                                received: applies ? 'Aplica' : 'No aplica'
                            });
                            return;
                        }

                        if (!applies) {
                            return;
                        }

                        const enteredCode =
                            fieldValue(
                                `${row.key}-code`
                            );

                        /*
                         * Algunos rangos de derechos de sala se liquidan
                         * mediante UVR × factor y no tienen código discreto.
                         * En ese caso no se exige inventar ni ingresar un código.
                         */
                        const formulaBasedRoom =
                            row.key === 'room' &&
                            data.factor !== undefined &&
                            !String(data.code || data.reference || '').trim();

                        if (!formulaBasedRoom) {

                            if (!enteredCode) {

                                errors.push({
                                    type: 'codigo-componente',
                                    label: `${row.label}: código`,
                                    received: 'Sin ingresar'
                                });

                            } else if (
                                data.reference &&
                                normalize(enteredCode) !== normalize(data.reference)
                            ) {

                                errors.push({
                                    type: 'codigo-componente',
                                    label: `${row.label}: código`,
                                    received: enteredCode
                                });

                            } else if (
                                row.key === 'room' &&
                                !validRangeCode(enteredCode, 39209, 39230)
                            ) {

                                errors.push({
                                    type: 'codigo-componente',
                                    label: 'Derechos de sala: código fuera del rango ISS indicado'
                                });

                            } else if (
                                row.key === 'materials' &&
                                !validRangeCode(enteredCode, 39301, 39314)
                            ) {

                                errors.push({
                                    type: 'codigo-componente',
                                    label: 'Materiales: código fuera del rango ISS indicado'
                                });

                            }

                        }

                        if (data.factor !== undefined) {

                            // En esta interfaz, `${row.key}-uvr` contiene la tarifa por UVR,
                            // no las UVR del procedimiento. Estas últimas se validan arriba.
                            const enteredFactor = fieldValue(`${row.key}-uvr`);
                            const expectedFactor = numberValue(data.factor);
                            const procedureUVR = fieldNumber('procedure-uvr');
                            const calculated = procedureUVR * fieldNumber(`${row.key}-uvr`);
                            const expectedValue = data.value !== undefined && data.value !== null
                                ? numberValue(data.value)
                                : numberValue(data.expectedValue);

                            if (!enteredFactor) {
                                errors.push({
                                    type: 'factor',
                                    label: `${row.label}: tarifa por UVR`,
                                    received: 'Sin ingresar'
                                });
                            } else if (Math.abs(fieldNumber(`${row.key}-uvr`) - expectedFactor) > 0.01) {
                                errors.push({
                                    type: 'factor',
                                    label: `${row.label}: tarifa por UVR`,
                                    received: fieldNumber(`${row.key}-uvr`)
                                });
                            }

                            if (expectedValue && Math.abs(calculated - expectedValue) > 0.01) {
                                errors.push({
                                    type: 'total',
                                    label: `${row.label}: total`,
                                    received: formatCOP(calculated)
                                });
                            }

                        } else {

                            const enteredValue =
                                fieldValue(
                                    `${row.key}-value`
                                );

                            const expectedValue =
                                data.value;

                            /*
                             * Sala y materiales ahora también tienen
                             * resultado almacenado en cases.json cuando
                             * el Manual define una tarifa fija.
                             *
                             * Si materiales son >170 UVR, el Manual
                             * establece facturación por consumo y no
                             * existe una tarifa fija única.
                             */
                            if (
                                expectedValue !== undefined &&
                                expectedValue !== null
                            ) {

                                if (!enteredValue) {

                                    errors.push({
                                        type: 'valor',
                                        label:
                                            `${row.label}: valor`,
                                        received:
                                            'Sin ingresar'
                                    });

                                } else if (
                                    Math.abs(
                                        fieldNumber(
                                            `${row.key}-value`
                                        ) -
                                        numberValue(
                                            expectedValue
                                        )
                                    ) > 0.01
                                ) {

                                    errors.push({
                                        type: 'valor',
                                        label:
                                            `${row.label}: valor`,
                                        received:
                                            formatCOP(
                                                fieldNumber(
                                                    `${row.key}-value`
                                                )
                                            )
                                    });

                                }

                            } else if (
                                data.consumptionBased
                            ) {

                                /*
                                 * No se inventa una cifra de consumo.
                                 * El caso queda identificado como
                                 * "por consumo" y el total final no se
                                 * puede cerrar sin el valor real de
                                 * materiales consumidos.
                                 */
                                if (enteredValue) {

                                    const entered =
                                        fieldNumber(
                                            `${row.key}-value`
                                        );

                                    if (
                                        entered < 0
                                    ) {

                                        errors.push({
                                            type: 'valor',
                                            label:
                                                `${row.label}: consumo`,
                                            received:
                                                formatCOP(
                                                    entered
                                                )
                                        });

                                    }

                                }

                            } else {

                                errors.push({
                                    type: 'valor',
                                    label:
                                        `${row.label}: valor`,
                                    received:
                                        'Sin configurar en el caso'
                                });

                            }

                        }

                    }
                );
        }

        /*
         * Validación final contra el resultado almacenado del caso.
         * Solo se compara un total numérico cuando el Manual permite
         * cerrarlo con los datos existentes en el caso.
         */
        const result =
            solution.result || {};

        if (
            result.complete &&
            result.finalValue !== undefined &&
            result.finalValue !== null
        ) {

            let calculatedTotal = 0;

            if (type === 'direct') {

                calculatedTotal =
                    fieldNumber(
                        'procedure-value'
                    );

            } else {

                componentRows(solution)
                    .forEach(
                        row => {

                            if (
                                !fieldChecked(
                                    row.key
                                )
                            ) {
                                return;
                            }

                            const data =
                                row.data || {};

                            if (
                                data.factor !== undefined
                            ) {

                                calculatedTotal +=
                                    fieldNumber(
                                        `${row.key}-uvr`
                                    ) *
                                    fieldNumber(
                                        `${row.key}-factor`
                                    );

                            } else {

                                calculatedTotal +=
                                    fieldNumber(
                                        `${row.key}-value`
                                    );

                            }

                        }
                    );

            }

            calculatedTotal +=
                numberValue(
                    result.adjustments
                );

            calculatedTotal -=
                numberValue(
                    result.copay
                );

            if (
                Math.abs(
                    calculatedTotal -
                    numberValue(
                        result.finalValue
                    )
                ) > 0.01
            ) {

                errors.push({
                    type: 'total',
                    label: 'Valor final de la liquidación',
                    received:
                        formatCOP(
                            calculatedTotal
                        )
                });

            }

        }

        return {
            correct:
                errors.length === 0,
            errors
        };
    }

    /*
     * ------------------------------------------------------------
     * RESULTADO DE VALIDACIÓN — MENSAJES PRECISOS
     * ------------------------------------------------------------
     * El validador ISS usa errores con label/received/expected.
     * El renderer antiguo esperaba index/expected numérico y podía
     * terminar mostrando "correcto" o "$0" aunque hubiera error.
     */
    function ensureISSSuccessModal() {

        if (document.getElementById('simuips-iss-success-modal')) {
            return document.getElementById('simuips-iss-success-modal');
        }

        if (!document.getElementById('simuips-iss-success-modal-style')) {
            const style = document.createElement('style');
            style.id = 'simuips-iss-success-modal-style';
            style.textContent = `
                #simuips-iss-success-modal {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    background: rgba(2, 7, 12, .78);
                    backdrop-filter: blur(8px);
                }
                #simuips-iss-success-modal.hidden {
                    display: none;
                }
                .simuips-success-dialog {
                    position: relative;
                    width: min(620px, 100%);
                    max-height: min(760px, 90vh);
                    overflow: auto;
                    border: 1px solid rgba(46, 211, 183, .35);
                    border-radius: 20px;
                    background: #0b141d;
                    box-shadow: 0 30px 90px rgba(0,0,0,.55);
                    padding: 30px;
                    color: #fff;
                }
                .simuips-success-close {
                    position: absolute;
                    top: 14px;
                    right: 14px;
                    width: 36px;
                    height: 36px;
                    border: 1px solid rgba(255,255,255,.12);
                    border-radius: 50%;
                    background: rgba(255,255,255,.04);
                    color: #dce7ef;
                    cursor: pointer;
                    font-size: 22px;
                    line-height: 1;
                }
                .simuips-success-icon {
                    width: 58px;
                    height: 58px;
                    display: grid;
                    place-items: center;
                    margin-bottom: 16px;
                    border-radius: 50%;
                    background: rgba(22,163,74,.14);
                    border: 1px solid rgba(34,197,94,.45);
                    color: #4ade80;
                    font-size: 30px;
                    font-weight: 800;
                }
                .simuips-success-eyebrow {
                    display: block;
                    margin-bottom: 6px;
                    color: #38d9bd;
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: .12em;
                    text-transform: uppercase;
                }
                .simuips-success-title {
                    margin: 0;
                    font-size: clamp(26px, 4vw, 36px);
                    line-height: 1.1;
                }
                .simuips-success-subtitle {
                    margin: 10px 0 22px;
                    color: #aebdca;
                    line-height: 1.5;
                }
                .simuips-success-summary {
                    display: grid;
                    gap: 10px;
                    margin-bottom: 22px;
                }
                .simuips-success-row {
                    display: flex;
                    justify-content: space-between;
                    gap: 20px;
                    padding: 13px 15px;
                    border: 1px solid rgba(255,255,255,.08);
                    border-radius: 10px;
                    background: rgba(255,255,255,.025);
                }
                .simuips-success-row span:first-child {
                    color: #9eb0bd;
                }
                .simuips-success-row strong {
                    text-align: right;
                    color: #fff;
                }
                .simuips-success-xp {
                    margin-bottom: 22px;
                    padding: 12px 15px;
                    border-left: 3px solid #38d9bd;
                    border-radius: 0 9px 9px 0;
                    background: rgba(56,217,189,.07);
                    color: #c9fff5;
                }
                .simuips-success-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                .simuips-success-next {
                    min-height: 46px;
                    padding: 0 20px;
                    border: 0;
                    border-radius: 10px;
                    background: #2ed3b7;
                    color: #03110e;
                    font-weight: 800;
                    cursor: pointer;
                }
            `;
            document.head.appendChild(style);
        }

        const modal = document.createElement('div');
        modal.id = 'simuips-iss-success-modal';
        modal.className = 'hidden';
        modal.innerHTML = `
            <div class="simuips-success-dialog" role="dialog" aria-modal="true" aria-labelledby="simuips-iss-success-title">
                <button type="button" class="simuips-success-close" data-iss-success-close aria-label="Cerrar">×</button>
                <div class="simuips-success-icon">✓</div>
                <span class="simuips-success-eyebrow">EJERCICIO COMPLETADO</span>
                <h2 id="simuips-iss-success-title" class="simuips-success-title">¡Completado con éxito!</h2>
                <p class="simuips-success-subtitle">Revisaste y completaste correctamente la liquidación de este caso.</p>
                <div class="simuips-success-summary" data-iss-success-summary></div>
                <div class="simuips-success-xp" data-iss-success-xp></div>
                <div class="simuips-success-actions">
                    <button type="button" class="simuips-success-next" data-iss-success-next>Continuar con el siguiente caso →</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener('click', event => {
            if (event.target === modal || event.target.closest('[data-iss-success-close]')) {
                hideISSSuccessModal();
            }

            if (event.target.closest('[data-iss-success-next]')) {
                hideISSSuccessModal();
                goToNextCase();
            }
        });

        return modal;
    }

    function buildISSSuccessSummary(caseData) {

        const rows = [];
        const type = issType(caseData);

        const procedureCode = fieldValue('procedure-code') || '—';
        rows.push(['Código del procedimiento', procedureCode]);

        if (type === 'direct') {
            rows.push(['Valor del servicio', formatCOP(fieldNumber('procedure-value'))]);
        } else {
            rows.push(['UVR del procedimiento', fieldValue('procedure-uvr') || '—']);

            componentRows(issSolution(caseData)).forEach(row => {
                if (!fieldChecked(row.key)) return;

                const values = [];
                const code = fieldValue(`${row.key}-code`);
                const uvr = fieldValue(`${row.key}-uvr`);
                const factor = fieldValue(`${row.key}-factor`);
                const directValue = fieldValue(`${row.key}-value`);

                if (code) values.push(`Código ${code}`);
                if (uvr) values.push(`UVR ${uvr}`);
                if (factor) values.push(`Factor ${factor}`);
                if (directValue) values.push(formatCOP(fieldNumber(`${row.key}-value`)));

                rows.push([row.label, values.length ? values.join(' · ') : 'Marcado como aplica']);
            });
        }

        rows.push(['Total liquidado', textContentById('billing-total') || formatCOP(0)]);

        return rows
            .map(([label, valueToShow]) => `
                <div class="simuips-success-row">
                    <span>${escapeHTML(label)}</span>
                    <strong>${escapeHTML(valueToShow)}</strong>
                </div>
            `)
            .join('');
    }

    function textContentById(id) {
        return String($(id)?.textContent || '').trim();
    }

    function showISSSuccessModal(caseData) {

        const modal = ensureISSSuccessModal();
        const summary = modal.querySelector('[data-iss-success-summary]');
        const xp = modal.querySelector('[data-iss-success-xp]');
        const nextButton = modal.querySelector('[data-iss-success-next]');

        if (summary) {
            summary.innerHTML = buildISSSuccessSummary(caseData);
        }

        const xpValue =
            typeof getXPForCurrentCase === 'function'
                ? getXPForCurrentCase()
                : 25;

        if (xp) {
            xp.textContent = `+${xpValue} XP por completar correctamente este ejercicio.`;
        }

        const isLast =
            state.currentActivity &&
            state.currentCaseIndex >=
                state.currentActivityCases.length - 1;

        if (nextButton) {
            nextButton.textContent =
                isLast
                    ? 'Finalizar actividad →'
                    : 'Continuar con el siguiente caso →';
        }

        modal.classList.remove('hidden');
    }

    function hideISSSuccessModal() {
        document
            .getElementById('simuips-iss-success-modal')
            ?.classList.add('hidden');
    }

    renderValidationResult = function renderValidationResultV4(
        correct,
        errors
    ) {

        show('billing-validation-card');

        const icon = $('billing-validation-icon');
        if (icon) {
            icon.textContent = correct ? '✓' : '!';
            icon.classList.toggle('is-error', !correct);
        }

        text(
            'billing-validation-label',
            correct ? 'VALIDADO' : 'REVISAR'
        );

        text(
            'billing-validation-title',
            correct
                ? '¡Liquidación correcta!'
                : '¡Fallaste esta liquidación!'
        );

        text(
            'billing-validation-message',
            correct
                ? 'La liquidación coincide con la configuración del caso. Has ganado experiencia.'
                : 'La liquidación no es correcta. No te mostramos la respuesta; revisa los campos marcados e inténtalo nuevamente.'
        );

        const details = $('billing-validation-details');

        updateISSProcedureCodeVisualState(
            state.currentCase
        );

        if (!details) return;

        // Nunca se revela la respuesta correcta. En caso de error
        // solo se indican los campos/conceptos que deben revisarse.
        document
            .querySelectorAll(
                '#manual-concepts .iss-table-input'
            )
            .forEach(input => {
                input.classList.remove('iss-invalid');
            });

        if (correct) {
            details.innerHTML = '';
            hide('billing-validation-card');
            showISSSuccessModal(state.currentCase);
            return;
        }

        const invalidInputs = new Set();

        errors.forEach(error => {
            const label = normalize(error.label || '');

            if (label.includes('codigo del procedimiento')) {
                invalidInputs.add('procedure-code');
            } else if (label.includes('valor del servicio')) {
                invalidInputs.add('procedure-value');
            } else if (label.includes('uvr del procedimiento')) {
                invalidInputs.add('procedure-uvr');
            }

            componentRows(
                state.currentCase?.issSolution || {}
            ).forEach(row => {
                const rowLabel = normalize(row.label);

                if (label.includes(rowLabel)) {
                    invalidInputs.add(`${row.key}-code`);
                    invalidInputs.add(`${row.key}-uvr`);
                    invalidInputs.add(`${row.key}-factor`);
                    invalidInputs.add(`${row.key}-value`);
                }
            });
        });

        invalidInputs.forEach(name => {
            document
                .querySelectorAll(
                    `#manual-concepts [data-iss-field="${name}"]`
                )
                .forEach(input => {
                    input.classList.add('iss-invalid');
                });
        });

        const uniqueLabels = [
            ...new Set(
                errors.map(error =>
                    error.label ||
                    'Revisa los datos ingresados'
                )
            )
        ];

        details.innerHTML = uniqueLabels
            .map(label =>
                `<li><strong>${escapeHTML(label)}</strong><span>Revisa este dato antes de volver a validar.</span></li>`
            )
            .join('');
    };

    /*
     * Sustituimos únicamente la parte visual de conceptos.
     * Auditoría conserva el motor anterior.
     */
    const previousRenderBillingConcepts =
        renderBillingConcepts;

    renderBillingConcepts =
        function renderBillingConceptsV4(caseData) {

            if (
                state.currentMode === 'manual' &&
                caseData?.issSolution
            ) {

                const componentCount =
                    componentRows(
                        caseData.issSolution
                    ).length;

                const card =
                    $('manual-concepts-card');

                const title =
                    card?.querySelector('h2');

                const description =
                    card?.querySelector('.section-description');

                if (title) {
                    title.textContent =
                        componentCount
                            ? 'Conceptos aplicables'
                            : 'Procedimiento a liquidar';
                }

                if (description) {
                    description.textContent =
                        componentCount
                            ? 'Registra únicamente los conceptos que correspondan al procedimiento y al caso.'
                            : 'Registra únicamente la información que esté definida para este procedimiento en la fuente del caso.';
                }

                renderISSPracticeTable(
                    caseData
                );

                /*
                 * El resumen de liquidación solo tiene sentido cuando
                 * el caso realmente tiene conceptos/componentes que
                 * generan una liquidación. Si la fuente solo aporta
                 * código, descripción y UVR, no mostramos un resumen
                 * vacío con todos los valores en $0.
                 */
                const billingSummary =
                    document.querySelector(
                        '#page-billing .billing-summary, #page-billing .totals-card'
                    );

                const hasLiquidationComponents =
                    componentRows(
                        caseData.issSolution
                    ).length > 0;

                if (billingSummary) {
                    billingSummary.classList.toggle(
                        'hidden',
                        !hasLiquidationComponents
                    );
                }

                toggle(
                    'manual-concepts-card',
                    true
                );

                toggle(
                    'automatic-concepts-card',
                    false
                );

                return;
            }

            const billingSummary =
                document.querySelector(
                    '#page-billing .billing-summary, #page-billing .totals-card'
                );

            if (billingSummary) {
                billingSummary.classList.remove('hidden');
            }

            previousRenderBillingConcepts(
                caseData
            );
        };

    const previousUpdateBillingTotals =
        updateBillingTotals;

    updateBillingTotals =
        function updateBillingTotalsV4() {

            if (
                state.currentMode === 'manual' &&
                state.currentCase?.issSolution
            ) {

                updateISSPracticeTotal(
                    state.currentCase
                );

                return;
            }

            previousUpdateBillingTotals();
        };

    const previousRenderBillingProcedure =
        renderBillingProcedure;

    renderBillingProcedure =
        function renderBillingProcedureV4(caseData) {

            if (
                state.currentMode === 'manual' &&
                caseData?.issSolution
            ) {

                renderPracticeProcedureHeader(
                    caseData
                );

                return;
            }

            previousRenderBillingProcedure(
                caseData
            );
        };

    const previousValidateCurrentBilling =
        validateCurrentBilling;

    validateCurrentBilling =
        async function validateCurrentBillingV4() {

            const caseData =
                state.currentCase;

            if (
                !caseData
            ) {
                return;
            }

            /*
             * Auditoría continúa usando su validación existente.
             */
            if (
                state.currentMode !== 'manual' ||
                !caseData.issSolution
            ) {

                return previousValidateCurrentBilling();
            }

            const result =
                validateISSPractice(
                    caseData
                );

            state.currentValidation = {
                correct:
                    result.correct,
                errors:
                    result.errors,
                answers: {}
            };

            renderValidationResult(
                result.correct,
                result.errors
            );

            updateISSPracticeTotal(
                caseData
            );

            registerAttempt(
                result.correct
            );

        };

    /*
     * Puente para el validador final del archivo.
     * Más abajo existe otro setupBilling que reemplaza
     * validateCurrentBilling; este puente evita que ese código
     * vuelva a saltarse la validación ISS.
     */
    window.__simuipsValidateISSPractice =
        validateISSPractice;

    window.__simuipsRenderISSValidation =
        renderValidationResult;

    /*
     * La pantalla de práctica debe arrancar limpia.
     */
    const previousStartPracticeCase =
        startPracticeCase;

    startPracticeCase =
        async function startPracticeCaseV4(
            mode = 'manual'
        ) {

            hideISSSuccessModal();

            const result =
                await previousStartPracticeCase(
                    mode
                );

            state.currentValidation =
                null;

            return result;
        };

    /*
     * Refuerzo del texto de modo y ocultamiento del botón
     * "Agregar concepto", que ya no corresponde al ejercicio ISS.
     */
    const previousUpdateBillingMode =
        updateBillingMode;

    updateBillingMode =
        function updateBillingModeV4() {

            previousUpdateBillingMode();

            document
                .querySelectorAll(
                    '#page-billing [data-billing-mode], ' +
                    '#page-billing .billing-mode-button, ' +
                    '#page-billing .billing-mode-selector'
                )
                .forEach(
                    element => {
                        element.remove();
                    }
                );

            hide('add-manual-concept');

            document
                .querySelectorAll('#page-billing button, #page-billing [role="button"], #manual-concepts button')
                .forEach(element => {
                    if (/agregar concepto/i.test((element.textContent || '').trim())) {
                        element.style.setProperty('display', 'none', 'important');
                    }
                });

            const badge =
                document.querySelector(
                    '#billing-current-mode-badge, ' +
                    '#page-billing .billing-current-mode'
                );

            if (badge) {

                badge.textContent =
                    state.currentMode === 'automatic'
                        ? 'Modo auditoría'
                        : 'Liquidación manual';

            }

        };

    /*
     * Cuando se selecciona un resultado del catálogo, el sistema
     * conserva la selección pero vuelve a pintar la tabla sin
     * rellenar los demás valores de la respuesta.
     */
    document.addEventListener(
        'click',
        event => {

            const button =
                event.target.closest(
                    '[data-catalog-type="procedure"]'
                );

            if (
                !button ||
                state.currentMode !== 'manual' ||
                !state.currentCase?.issSolution
            ) {
                return;
            }

            setTimeout(
                () => {

                    renderPracticeProcedureHeader(
                        state.currentCase
                    );

                    const code =
                        getCode(
                            state.selectedProcedure ||
                            {}
                        );

                    const input =
                        document.querySelector(
                            '#manual-concepts [data-iss-field="procedure-code"]'
                        );

                    if (input && code) {
                        input.value = code;
                        setHiddenProcedureCode(code);
                    }

                    /*
                     * Seleccionar un procedimiento del catálogo
                     * no debe rellenar UVR ni tarifas.
                     */
                    state.currentValidation =
                        null;

                    hide(
                        'billing-validation-card'
                    );

                },
                0
            );

        }
    );

    /*
     * Evita que el antiguo botón "Cambiar" reconstruya una UI
     * diferente durante práctica manual.
     */
    $('change-procedure')
        ?.addEventListener(
            'click',
            event => {

                if (
                    state.currentMode === 'manual' &&
                    state.currentCase?.issSolution
                ) {

                    event.preventDefault();
                    event.stopImmediatePropagation();

                    renderPracticeProcedureHeader(
                        state.currentCase
                    );

                }

            },
            true
        );

})();

/* ============================================================
   INICIALIZACIÓN PRINCIPAL
============================================================ */

async function initializeApplication() {
    // SimuIPS funciona exclusivamente como invitado y usa catálogos/actividades locales.
    state.guest = true;
    state.user = {
        id: `GUEST_${generateId('SESSION')}`,
        name: 'Invitado',
        lastname: '',
        role: 'student'
    };

    setupGuestEntry();
    setupNavigation();
    setupBilling();
    setupForms();
    setupGlobalDelegation();
    setupGlobalSearch();

    const guest = restoreGuestSession();
    if (guest) {
        state.guest = true;
        state.user = guest.user || state.user;
        loadProgress();
        showApplication();
        renderApplication();
        return;
    }

    showEntryScreen();
}

/* ============================================================
   ARRANQUE
============================================================ */

async function bootstrapApplication() {

    try {

        await initializeApplication();

    } catch (
        error
    ) {

        console.error(
            '[SimuIPS] Error durante la inicialización:',
            error
        );

        state.user =
            null;

        state.guest =
            false;

        showEntryScreen();

    } finally {

        hideLoadingScreen();

    }

}


if (
    document.readyState ===
    'loading'
) {

    document.addEventListener(
        'DOMContentLoaded',
        bootstrapApplication,
        {
            once: true
        }
    );

} else {

    bootstrapApplication();

}


window.addEventListener('pagehide', () => {
    if (isGuest()) saveGuestSession();
});

window.addEventListener('beforeunload', () => {
    if (isGuest()) saveGuestSession();
});


/* ============================================================
   SIMUIPS 3.0 — CAPA DE CATÁLOGOS Y MOTOR DE LIQUIDACIÓN
   Este bloque reemplaza la lógica anterior de catálogos sin
   eliminar la funcionalidad de cuentas, clases, actividades,
   invitados, XP, resultados y navegación.

   CONTRATO FUTURO:
   - /js/iss.js    -> window.SimuIPS_ISS
   - /js/cups.js   -> window.SimuIPS_CUPS
   - /js/cie10.js  -> window.SimuIPS_CIE10
   - /js/cum.js    -> window.SimuIPS_CUM

   Cada módulo puede exponer:
       search(query, limit)
       get(code)
       all()
       getTariff(code)       // ISS
       calculate(caseData)   // ISS opcional

   Si el módulo todavía no existe, se usa el JSON configurado
   en APP.data como respaldo. No se inventan códigos ni tarifas.
============================================================ */

(function SIMUIPS_V3_BOOTSTRAP() {

    'use strict';

    const MODULE_PATHS = Object.freeze({
        iss: './iss.js',
        cups: './cups.js',
        cie10: './cie10.js',
        cum: './cum.js',
        eps: './eps.js'
    });

    const MODULE_GLOBALS = Object.freeze({
        iss: 'SimuIPS_ISS',
        cups: 'SimuIPS_CUPS',
        cie10: 'SimuIPS_CIE10',
        cum: 'SimuIPS_CUM',
        eps: 'SimuIPS_EPS'
    });

    const modulePromises = {};

    function catalogArray(data) {
        if (Array.isArray(data)) return data;
        if (!data || typeof data !== 'object') return [];

        const keys = [
            'data', 'items', 'records', 'results', 'rows',
            'catalog', 'catalogo', 'procedures', 'procedimientos',
            'diagnoses', 'diagnosticos', 'medicines', 'medicamentos',
            'cases', 'casos'
        ];

        for (const key of keys) {
            if (Array.isArray(data[key])) return data[key];
        }

        return [];
    }

    function moduleObject(name) {
        const globalName = MODULE_GLOBALS[name];
        return globalName ? window[globalName] : null;
    }

    function loadScriptOnce(name) {
        const globalName = MODULE_GLOBALS[name];

        if (!MODULE_PATHS[name]) {
            return Promise.resolve(null);
        }

        if (moduleObject(name)) {
            return Promise.resolve(moduleObject(name));
        }

        if (modulePromises[name]) {
            return modulePromises[name];
        }

        modulePromises[name] = new Promise(resolve => {
            const existing = document.querySelector(
                `script[data-simuips-catalog="${name}"]`
            );

            if (existing) {
                const finish = () => resolve(moduleObject(name) || null);
                existing.addEventListener('load', finish, { once: true });
                existing.addEventListener('error', () => resolve(null), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = MODULE_PATHS[name];
            script.async = true;
            script.dataset.simuipsCatalog = name;

            script.onload = () => resolve(moduleObject(name) || null);
            script.onerror = () => resolve(null);

            document.head.appendChild(script);
        });

        return modulePromises[name];
    }

    function getCatalogItemCode(item) {
        if (!item) return '';

        return String(
            item.code ??
            item.codigo ??
            item.codigoISS ??
            item.codigoCUPS ??
            item.codigoCIE10 ??
            item.codigoCUM ??
            item.cups ??
            item.cie10 ??
            item.cum ??
            item.iss ??
            ''
        );
    }

    function getCatalogItemName(item) {
        if (!item) return '';

        return String(
            item.name ??
            item.nombre ??
            item.description ??
            item.descripcion ??
            item.descripcionCUPS ??
            item.descripcionCIE10 ??
            item.descripcionCUM ??
            item.descripcionProcedimiento ??
            item.detalle ??
            ''
        );
    }

    function getCatalogItemTariff(item) {
        if (!item) return null;

        const raw =
            item.tariff ??
            item.tarifa ??
            item.value ??
            item.valor ??
            item.price ??
            item.precio ??
            item.valorTotal ??
            null;

        if (
            raw === null ||
            raw === undefined ||
            raw === ''
        ) {
            return null;
        }

        const parsed = numberValue(raw);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function normalizeCatalogItem(item, source) {
        if (!item || typeof item !== 'object') {
            return null;
        }

        const code = getCatalogItemCode(item);
        const name = getCatalogItemName(item);

        return {
            ...clone(item),
            code,
            name,
            source:
                item.source ||
                item.system ||
                item.sistema ||
                source
        };
    }

    async function getCatalogModule(name) {
        return loadScriptOnce(name);
    }

    async function moduleSearch(name, query, limit) {
        const module = await getCatalogModule(name);

        if (!module) return null;

        try {
            if (typeof module.search === 'function') {
                const result = await module.search(query, limit);
                return catalogArray(result)
                    .map(item => normalizeCatalogItem(item, name.toUpperCase()))
                    .filter(Boolean)
                    .slice(0, limit);
            }

            if (typeof module.find === 'function') {
                const result = await module.find(query, limit);
                return catalogArray(result)
                    .map(item => normalizeCatalogItem(item, name.toUpperCase()))
                    .filter(Boolean)
                    .slice(0, limit);
            }

            if (typeof module.all === 'function') {
                const result = await module.all();
                return localCatalogSearch(
                    catalogArray(result),
                    query,
                    limit,
                    name.toUpperCase()
                );
            }

        } catch (error) {
            console.warn(
                `[SimuIPS] Error buscando en ${name}.`,
                error
            );
        }

        return null;
    }

    function localCatalogSearch(items, query, limit, source) {
        const q = normalize(query);

        if (!q) return [];

        return items
            .map(item => {
                const normalized = normalizeCatalogItem(item, source);
                if (!normalized) return null;

                const code = normalize(normalized.code);
                const name = normalize(normalized.name);

                let score = 0;

                if (code === q) score += 1000;
                if (code.includes(q)) score += 250;
                if (name.includes(q)) score += 100;

                q.split(/\s+/).forEach(token => {
                    if (token && name.includes(token)) score += 20;
                    if (token && code.includes(token)) score += 30;
                });

                return score > 0
                    ? { item: normalized, score }
                    : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(result => result.item);
    }

    async function moduleGet(name, code) {
        const module = await getCatalogModule(name);

        if (!module || !code) return null;

        try {
            if (typeof module.get === 'function') {
                const result = await module.get(code);
                return normalizeCatalogItem(
                    result,
                    name.toUpperCase()
                );
            }

            if (typeof module.findByCode === 'function') {
                const result = await module.findByCode(code);
                return normalizeCatalogItem(
                    result,
                    name.toUpperCase()
                );
            }

        } catch (error) {
            console.warn(
                `[SimuIPS] Error obteniendo ${name}:${code}`,
                error
            );
        }

        return null;
    }

    async function moduleTariff(code) {
        const module = await getCatalogModule('iss');

        if (!module || !code) return null;

        try {
            if (typeof module.getTariff === 'function') {
                return await module.getTariff(code);
            }

            if (typeof module.getTarifa === 'function') {
                return await module.getTarifa(code);
            }

        } catch (error) {
            console.warn(
                `[SimuIPS] Error obteniendo tarifa ISS ${code}.`,
                error
            );
        }

        return null;
    }

    /*
     * API pública que usarán el motor de la aplicación y los
     * módulos futuros.
     */
    window.SimuIPS_CatalogAPI = {
        loadModule: getCatalogModule,
        search: moduleSearch,
        get: moduleGet,
        getISSTariff: moduleTariff
    };

    /*
     * ------------------------------------------------------------
     * CARGA UNIFICADA
     * ------------------------------------------------------------
     */
    loadCatalog = async function catalogLoader(catalogName) {

        if (state.catalogs[catalogName]) {
            return catalogArray(state.catalogs[catalogName]);
        }

        if (state.catalogPromises[catalogName]) {
            return state.catalogPromises[catalogName];
        }

        state.catalogPromises[catalogName] = (async () => {

            /*
             * CUM es deliberadamente lazy. No se toca durante
             * inicio, dashboard, casos ni búsqueda de CIE-10.
             */
            const module = await getCatalogModule(catalogName);

            if (module) {

                try {
                    if (typeof module.all === 'function') {
                        const data = await module.all();

                        if (data !== undefined) {
                            state.catalogs[catalogName] = data;
                            return catalogArray(data);
                        }
                    }

                    if (typeof module.data !== 'undefined') {
                        state.catalogs[catalogName] = module.data;
                        return catalogArray(module.data);
                    }

                } catch (error) {
                    console.warn(
                        `[SimuIPS] No se pudo obtener ${catalogName} desde su módulo.`,
                        error
                    );
                }
            }

            const url = APP.data?.[catalogName];

            if (!url) {
                state.catalogs[catalogName] = [];
                return [];
            }

            try {
                const response = await fetch(
                    url,
                    {
                        cache: 'default'
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                state.catalogs[catalogName] = data;

                return catalogArray(data);

            } catch (error) {

                console.warn(
                    `[SimuIPS] No se pudo cargar ${catalogName}.`,
                    error
                );

                state.catalogs[catalogName] = [];
                return [];
            }

        })();

        try {
            return await state.catalogPromises[catalogName];
        } finally {
            delete state.catalogPromises[catalogName];
        }
    };

    /*
     * Búsqueda:
     * 1. módulo especializado
     * 2. catálogo JSON como respaldo
     *
     * Nunca se genera un código que no exista en la fuente.
     */
    searchCatalog = async function catalogSearch(
        catalogName,
        query,
        limit = 8
    ) {

        if (!String(query || '').trim()) {
            return [];
        }

        const moduleResult = await moduleSearch(
            catalogName,
            query,
            limit
        );

        if (moduleResult !== null) {
            return moduleResult;
        }

        const catalog = await loadCatalog(catalogName);

        return localCatalogSearch(
            catalog,
            query,
            limit,
            catalogName.toUpperCase()
        );
    };

    /*
     * ------------------------------------------------------------
     * CASOS
     * ------------------------------------------------------------
     */
    getCaseById = function caseById(id) {

        if (!id) return null;

        const local = state.cases.find(
            item => item?.id === id
        );

        if (local) return local;

        const catalogCases = catalogArray(
            state.catalogs.cases
        );

        return (
            catalogCases.find(
                item => item?.id === id
            ) ||
            (
                state.currentCase?.id === id
                    ? state.currentCase
                    : null
            )
        );
    };

    function caseModeMatches(item, mode) {
        const itemMode = String(
            item?.trainingMode ??
            item?.mode ??
            'both'
        ).toLowerCase();

        return (
            itemMode === 'both' ||
            itemMode === mode
        );
    }

    startPracticeCase = async function practiceCase(
        mode = 'manual'
    ) {

        state.currentMode =
            mode === 'automatic'
                ? 'automatic'
                : 'manual';

        state.currentActivity = null;
        state.currentActivityCases = [];
        state.currentCaseIndex = 0;
        state.currentLiquidation = null;
        state.currentValidation = null;

        const catalog = await loadCatalog('cases');

        const combined = [
            ...catalogArray(catalog),
            ...(Array.isArray(state.cases)
                ? state.cases
                : [])
        ];

        const unique = Array.from(
            new Map(
                combined
                    .filter(item => item?.id)
                    .map(item => [item.id, item])
            ).values()
        );

        const available = unique.filter(
            item => caseModeMatches(item, mode)
        );

        if (!available.length) {

            state.currentCase = null;
            showBillingEmpty(true);

            toast(
                'No hay casos disponibles para este modo.',
                'info'
            );

            return null;
        }

        state.currentCase = clone(
            available[
                Math.floor(
                    Math.random() * available.length
                )
            ]
        );

        state.selectedProcedure =
            clone(state.currentCase.procedure || null);

        state.selectedDiagnosis =
            clone(state.currentCase.diagnosis || null);

        renderBillingPage();
        saveGuestSession();

        return state.currentCase;
    };

    /*
     * ------------------------------------------------------------
     * CASOS CREADOS POR PROFESOR
     * ------------------------------------------------------------
     *
     * Un caso nunca acepta código escrito manualmente como fuente
     * oficial. El código debe venir de una selección del catálogo.
     */
    saveCase = async function saveCaseV3(event) {

        event?.preventDefault();

        if (state.user?.role !== 'teacher') {
            return;
        }

        const name = value('case-name');

        if (!name) {
            toast(
                'El caso necesita un nombre.',
                'warning'
            );
            return;
        }

        if (!state.selectedDiagnosis) {
            toast(
                'Selecciona un diagnóstico CIE-10 del catálogo.',
                'warning'
            );
            return;
        }

        if (!state.selectedProcedure) {
            toast(
                'Selecciona un procedimiento del catálogo.',
                'warning'
            );
            return;
        }

        const diagnosis = normalizeCatalogItem(
            state.selectedDiagnosis,
            'CIE10'
        );

        const procedureSource = String(
            state.selectedProcedure.source ||
            state.selectedProcedure.system ||
            value('case-procedure-system') ||
            'CUPS'
        ).toUpperCase();

        const procedure = normalizeCatalogItem(
            state.selectedProcedure,
            procedureSource
        );

        if (!diagnosis?.code) {
            toast(
                'El diagnóstico seleccionado no contiene un código CIE-10 válido.',
                'error'
            );
            return;
        }

        if (!procedure?.code) {
            toast(
                'El procedimiento seleccionado no contiene un código válido.',
                'error'
            );
            return;
        }

        /*
         * Si el procedimiento es ISS, intentamos recuperar su
         * registro completo desde iss.js. Si todavía no existe,
         * conservamos exactamente lo que seleccionó el catálogo.
         */
        const officialProcedure =
            await moduleGet(
                procedureSource.toLowerCase() === 'iss'
                    ? 'iss'
                    : procedureSource.toLowerCase() === 'cups'
                        ? 'cups'
                        : procedureSource.toLowerCase(),
                procedure.code
            );

        const finalProcedure =
            officialProcedure
                ? {
                    ...procedure,
                    ...officialProcedure,
                    source: procedureSource
                }
                : procedure;

        const existing =
            state.editingCaseId
                ? state.cases.find(
                    item =>
                        item.id ===
                        state.editingCaseId
                )
                : null;

        const baseCase = {

            name,

            difficulty:
                value('case-difficulty') ||
                'basic',

            description:
                value('case-description'),

            patient: {
                name:
                    value('case-patient-name'),

                document:
                    value('case-patient-document'),

                age:
                    numberValue(
                        value('case-patient-age')
                    ) || null,

                sex:
                    value('case-patient-sex')
            },

            diagnosis: {
                ...diagnosis,
                system: 'CIE10',
                catalog: 'CIE10'
            },

            procedure: {
                ...finalProcedure,
                system: procedureSource,
                catalog: procedureSource
            },

            /*
             * La tarifa se conserva solo si viene realmente
             * del registro seleccionado o de iss.js.
             */
            tariff:
                procedureSource === 'ISS'
                    ? (
                        finalProcedure.tariff ??
                        finalProcedure.tarifa ??
                        finalProcedure.value ??
                        finalProcedure.valor ??
                        null
                    )
                    : null,

            trainingMode:
                value('case-training-mode') ||
                'manual',

            attempts:
                Math.max(
                    1,
                    Number(
                        value('case-attempts')
                    ) || 1
                ),

            feedback:
                $('case-feedback')?.checked !== false,

            updatedAt:
                new Date().toISOString()
        };

        if (existing) {

            const index =
                state.cases.findIndex(
                    item =>
                        item.id ===
                        state.editingCaseId
                );

            if (index >= 0) {

                state.cases[index] = {
                    ...existing,
                    ...baseCase
                };

                toast(
                    'Caso actualizado.',
                    'success'
                );
            }

        } else {

            state.cases.push({

                id:
                    generateId('CASE'),

                teacherId:
                    state.user.id,

                createdAt:
                    new Date().toISOString(),

                ...baseCase
            });

            toast(
                'Caso creado correctamente.',
                'success'
            );
        }

        writeStorage(
            APP.storage.cases,
            state.cases
        );

        state.editingCaseId = null;
        state.selectedDiagnosis = null;
        state.selectedProcedure = null;

        navigate('teacher-cases');
    };

    /*
     * ------------------------------------------------------------
     * RENDER DE SELECCIONES
     * ------------------------------------------------------------
     */
    renderSelectedCatalogs = function renderSelectedCatalogsV3() {

        const diagnosis = state.selectedDiagnosis;
        const procedure = state.selectedProcedure;

        toggle(
            'case-selected-diagnosis',
            !!diagnosis
        );

        toggle(
            'case-selected-procedure',
            !!procedure
        );

        if (diagnosis) {

            text(
                'case-selected-diagnosis-name',
                getCatalogItemName(diagnosis)
            );

            text(
                'case-selected-diagnosis-code',
                getCatalogItemCode(diagnosis)
            );
        }

        if (procedure) {

            text(
                'case-selected-procedure-name',
                getCatalogItemName(procedure)
            );

            text(
                'case-selected-procedure-code',
                getCatalogItemCode(procedure)
            );

            const tariff =
                getCatalogItemTariff(procedure);

            text(
                'case-selected-procedure-tariff',
                tariff == null
                    ? ''
                    : formatCOP(tariff)
            );
        }
    };

    renderCatalogResults = function renderCatalogResultsV3(
        containerId,
        items,
        type
    ) {

        const container = $(containerId);

        if (!container) return;

        container._catalogItems = items || [];

        if (!items?.length) {

            container.innerHTML = `
                <div class="catalog-empty">
                    No se encontraron resultados.
                </div>
            `;

            return;
        }

        container.innerHTML = items
            .map((item, index) => {

                const code =
                    getCatalogItemCode(item);

                const name =
                    getCatalogItemName(item);

                const tariff =
                    getCatalogItemTariff(item);

                const source =
                    item.source ||
                    item.system ||
                    '';

                return `
                    <button
                        type="button"
                        class="catalog-result"
                        data-catalog-type="${escapeHTML(type)}"
                        data-catalog-index="${index}"
                    >
                        <strong>
                            ${escapeHTML(code || 'Sin código')}
                        </strong>

                        <span>
                            ${escapeHTML(name || 'Sin descripción')}
                        </span>

                        ${
                            source
                                ? `<small>${escapeHTML(source)}</small>`
                                : ''
                        }

                        ${
                            tariff != null
                                ? `<small>${formatCOP(tariff)}</small>`
                                : ''
                        }
                    </button>
                `;
            })
            .join('');
    };

    /*
     * ------------------------------------------------------------
     * BÚSQUEDAS DEL EDITOR
     * ------------------------------------------------------------
     */
    setupCaseFeatures = function setupCaseFeaturesV3() {

        const diagnosisInput =
            $('case-diagnosis-search');

        const procedureInput =
            $('case-procedure-search');

        const procedureSystem =
            $('case-procedure-system');

        if (diagnosisInput) {

            diagnosisInput.addEventListener(
                'input',
                debounce(
                    async event => {

                        const results =
                            await searchCatalog(
                                'cie10',
                                event.target.value,
                                8
                            );

                        renderCatalogResults(
                            'case-diagnosis-results',
                            results,
                            'diagnosis'
                        );
                    },
                    250
                )
            );
        }

        if (procedureInput) {

            procedureInput.addEventListener(
                'input',
                debounce(
                    async event => {

                        const system =
                            String(
                                procedureSystem?.value ||
                                'CUPS'
                            ).toLowerCase();

                        const catalog =
                            system === 'iss'
                                ? 'iss'
                                : 'cups';

                        const results =
                            await searchCatalog(
                                catalog,
                                event.target.value,
                                8
                            );

                        renderCatalogResults(
                            'case-procedure-results',
                            results,
                            'procedure'
                        );
                    },
                    250
                )
            );
        }

        procedureSystem?.addEventListener(
            'change',
            () => {

                state.selectedProcedure = null;

                renderSelectedCatalogs();

                if (procedureInput?.value.trim()) {
                    procedureInput.dispatchEvent(
                        new Event('input', {
                            bubbles: true
                        })
                    );
                }
            }
        );

        $('case-form')?.addEventListener(
            'submit',
            saveCase
        );

        renderSelectedCatalogs();
    };

    /*
     * ------------------------------------------------------------
     * BILLING: EL ESTUDIANTE NO VE LA RESPUESTA CORRECTA EN MANUAL
     * ------------------------------------------------------------
     */
    renderConceptInput = function renderConceptInputV3(
        concept,
        index,
        readonly
    ) {

        const key =
            concept.id ||
            concept.key ||
            `concept-${index}`;

        /*
         * Manual:
         * solo studentValue.
         *
         * Automático:
         * puede mostrar el valor esperado.
         */
        const initialValue = readonly
            ? (
                concept.correctValue ??
                concept.value ??
                concept.valor ??
                ''
            )
            : (
                concept.studentValue ??
                ''
            );

        return `
            <div
                class="concept-row"
                data-concept-key="${escapeHTML(key)}"
            >
                <div class="concept-main">
                    <strong>
                        ${escapeHTML(
                            concept.label ||
                            concept.name ||
                            concept.concepto ||
                            key
                        )}
                    </strong>

                    <small>
                        ${escapeHTML(
                            concept.unit ||
                            concept.unidad ||
                            ''
                        )}
                    </small>
                </div>

                <input
                    class="concept-value"
                    data-concept-index="${index}"
                    type="number"
                    step="any"
                    value="${escapeHTML(initialValue)}"
                    ${readonly ? 'readonly' : ''}
                >
            </div>
        `;
    };

    /*
     * La respuesta esperada se calcula exclusivamente desde
     * correctValue/value/valor ya definidos por el caso o por
     * el motor oficial. Nunca desde studentValue.
     */
    expectedValues = function expectedValuesV3(caseData) {

        const concepts =
            applicableConcepts(caseData);

        const expected = {};

        concepts.forEach((concept, index) => {

            expected[index] =
                numberValue(
                    concept.correctValue ??
                    concept.value ??
                    concept.valor ??
                    0
                );
        });

        return expected;
    };

    /*
     * ------------------------------------------------------------
     * MOTOR DE LIQUIDACIÓN
     * ------------------------------------------------------------
     */
    window.SimuIPS_BillingEngine = {

        async calculate(caseData) {

            if (!caseData) {
                return null;
            }

            const procedure =
                caseData.procedure || {};

            const source =
                String(
                    procedure.source ||
                    procedure.system ||
                    ''
                ).toUpperCase();

            /*
             * Si iss.js implementa calculate(), esa es la fuente
             * preferida para una liquidación ISS real.
             */
            if (source === 'ISS') {

                const iss =
                    await getCatalogModule('iss');

                if (
                    iss &&
                    typeof iss.calculate === 'function'
                ) {
                    return await iss.calculate(
                        clone(caseData)
                    );
                }
            }

            /*
             * Para casos que ya traen conceptos oficiales
             * configurados, calculamos con esos conceptos.
             */
            const concepts =
                applicableConcepts(caseData);

            const values = {};

            concepts.forEach((concept, index) => {

                values[index] =
                    numberValue(
                        concept.correctValue ??
                        concept.value ??
                        concept.valor ??
                        0
                    );
            });

            const subtotal =
                calculateTotal(values);

            const adjustments =
                numberValue(
                    caseData.adjustments ??
                    caseData.ajustes ??
                    0
                );

            const copay =
                numberValue(
                    caseData.copay ??
                    caseData.copago ??
                    0
                );

            return {
                concepts,
                values,
                subtotal,
                adjustments,
                copay,
                total: Math.max(
                    0,
                    subtotal +
                    adjustments -
                    copay
                )
            };
        }
    };

    /*
     * ------------------------------------------------------------
     * VALIDACIÓN
     * ------------------------------------------------------------
     */
    validateCurrentBilling = async function validateBillingV3() {

        const caseData =
            state.currentCase;

        if (!caseData) return;

        /*
         * PRÁCTICA ISS:
         * este validador se ejecuta antes de cualquier validación
         * genérica para impedir que un formulario vacío sea tomado
         * como correcto.
         */
        if (
            state.currentMode === 'manual' &&
            caseData.issSolution &&
            typeof window.__simuipsValidateISSPractice === 'function'
        ) {

            const result =
                window.__simuipsValidateISSPractice(
                    caseData
                );

            state.currentValidation = {
                correct: result.correct,
                errors: result.errors,
                answers: {}
            };

            if (
                typeof window.__simuipsRenderISSValidation === 'function'
            ) {
                window.__simuipsRenderISSValidation(
                    result.correct,
                    result.errors
                );
            }

            updateBillingTotals();
            registerAttempt(result.correct);

            return;
        }

        const answers =
            readBillingAnswers();

        const expected =
            expectedValues(caseData);

        const errors = [];

        Object.keys(expected).forEach(index => {

            const received =
                numberValue(
                    answers[index]
                );

            const expectedValue =
                numberValue(
                    expected[index]
                );

            if (
                Math.abs(
                    received -
                    expectedValue
                ) > 0.01
            ) {

                errors.push({
                    type: 'valor',
                    index: Number(index),
                    expected: expectedValue,
                    received
                });
            }
        });

        const procedure =
            caseData.procedure || {};

        const typedCode =
            value('billing-procedure-input');

        const officialCode =
            getCatalogItemCode(procedure);

        if (
            officialCode &&
            typedCode &&
            normalize(typedCode) !==
            normalize(officialCode)
        ) {

            errors.push({
                type: 'codigo',
                expected: officialCode,
                received: typedCode
            });
        }

        const correct =
            errors.length === 0;

        state.currentValidation = {
            correct,
            errors,
            answers
        };

        renderValidationResult(
            correct,
            errors
        );

        updateBillingTotals();

        registerAttempt(correct);
    };

    /*
     * ------------------------------------------------------------
     * BILLING SEARCH
     * ------------------------------------------------------------
     */
    setupBilling = function setupBillingV3() {

        document
            .querySelectorAll(
                '[data-billing-mode], .billing-mode-button'
            )
            .forEach(button => {

                if (
                    button.dataset.simuipsBillingBound
                ) {
                    return;
                }

                button.dataset.simuipsBillingBound =
                    'true';

                button.addEventListener(
                    'click',
                    () => {

                        state.currentMode =
                            button.dataset.billingMode ||
                            button.dataset.mode ||
                            'manual';

                        state.currentValidation =
                            null;

                        if (
                            state.currentCase
                        ) {
                            renderBillingPage();
                        } else {
                            startPracticeCase(
                                state.currentMode
                            );
                        }
                    }
                );
            });

        $('billing-procedure-input')
            ?.addEventListener(
                'input',
                debounce(
                    async event => {

                        const source =
                            String(
                                state.currentCase
                                    ?.procedure
                                    ?.source ||
                                state.currentCase
                                    ?.procedure
                                    ?.system ||
                                'CUPS'
                            ).toLowerCase();

                        const catalog =
                            source === 'iss'
                                ? 'iss'
                                : 'cups';

                        const results =
                            await searchCatalog(
                                catalog,
                                event.target.value,
                                8
                            );

                        renderCatalogResults(
                            'billing-procedure-results',
                            results,
                            'procedure'
                        );
                    },
                    250
                )
            );

        $('billing-validate-button')
            ?.addEventListener(
                'click',
                () => {
                    validateCurrentBilling();
                }
            );

        $('billing-next-button')
            ?.addEventListener(
                'click',
                () => {
                    goToNextCase();
                }
            );

        setupBillingConceptInputs();
    };

    /*
     * ------------------------------------------------------------
     * SELECCIÓN DE CATÁLOGOS
     * ------------------------------------------------------------
     */
    const previousGlobalDelegation =
        setupGlobalDelegation;

    /*
     * No reemplazamos toda la delegación existente. Añadimos una
     * capa pequeña para las selecciones de catálogos, evitando
     * duplicar listeners.
     */
    document.addEventListener(
        'click',
        event => {

            const button =
                event.target.closest(
                    '[data-catalog-type]'
                );

            if (!button) return;

            const container =
                button.parentElement;

            const index =
                Number(
                    button.dataset.catalogIndex
                );

            const item =
                container?._catalogItems?.[index];

            if (!item) return;

            if (
                button.dataset.catalogType ===
                'diagnosis'
            ) {

                state.selectedDiagnosis =
                    clone(item);

                renderSelectedCatalogs();

            } else if (
                button.dataset.catalogType ===
                'procedure'
            ) {

                state.selectedProcedure =
                    clone(item);

                renderSelectedCatalogs();
            }

            /*
             * Si estamos dentro de un caso en edición/práctica,
             * actualizar únicamente la selección actual.
             */
            if (state.currentCase) {

                if (
                    button.dataset.catalogType ===
                    'procedure'
                ) {
                    state.currentCase.procedure =
                        clone(item);

                    state.selectedProcedure =
                        clone(item);

                    const procedureInput =
                        $('billing-procedure-input');

                    if (procedureInput) {
                        procedureInput.value =
                            getCode(item) ||
                            getName(item) ||
                            '';
                    }

                    const procedureResults =
                        $('billing-procedure-results');

                    if (procedureResults) {
                        procedureResults.innerHTML = '';
                    }

                    renderBillingProcedure(
                        state.currentCase
                    );
                }

                if (
                    button.dataset.catalogType ===
                    'diagnosis'
                ) {
                    state.currentCase.diagnosis =
                        clone(item);
                }
            }
        }
    );

    /*
     * ------------------------------------------------------------
     * ACTIVIDADES: ownership y código
     * ------------------------------------------------------------
     */
    const originalRenderActivityEditor =
        renderActivityEditor;

    renderActivityEditor =
        function renderActivityEditorV3() {

            originalRenderActivityEditor();

            /*
             * El editor original ya prepara clases y casos.
             * Aquí no se insertan códigos oficiales manuales.
             */
        };

    /*
     * ------------------------------------------------------------
     * SEGURIDAD DE CASOS/ACTIVIDADES
     * ------------------------------------------------------------
     */
    const originalCanAccessPage =
        canAccessPage;

    canAccessPage = function canAccessPageV3(page) {

        if (!state.user && !isGuest()) {
            return false;
        }

        if (isGuest()) {
            return [
                'dashboard',
                'manual-mode',
                'automatic-mode',
                'billing',
                'test-iss',
                'settings'
            ].includes(page);
        }

        if (
            page.startsWith('teacher-') ||
            page === 'create-case' ||
            page === 'create-activity'
        ) {
            return state.user?.role === 'teacher';
        }

        return originalCanAccessPage(page);
    };

    /*
     * ------------------------------------------------------------
     * CUM LAZY
     * ------------------------------------------------------------
     */
    window.SimuIPS_CUM_API = {
        async search(query, limit = 8) {

            const moduleResult =
                await moduleSearch(
                    'cum',
                    query,
                    limit
                );

            return moduleResult || [];
        },

        async get(code) {
            return moduleGet('cum', code);
        }
    };

    /*
     * ------------------------------------------------------------
     * DIAGNÓSTICO Y PROCEDIMIENTO API
     * ------------------------------------------------------------
     */
    window.SimuIPS = {
        version: '3.0.0',
        state,

        catalogs: {
            async search(type, query, limit = 8) {
                return searchCatalog(
                    String(type).toLowerCase(),
                    query,
                    limit
                );
            },

            async get(type, code) {
                return moduleGet(
                    String(type).toLowerCase(),
                    code
                );
            }
        },

        billing: window.SimuIPS_BillingEngine,

        canAccessPage,
        getCaseById,
        loadCatalog,
        searchCatalog,
        startPracticeCase
    };

    /*
     * ------------------------------------------------------------
     * REFRESCO SEGURO
     * ------------------------------------------------------------
     *
     * Si este script fue cargado cuando el DOM ya estaba listo,
     * el bootstrap original pudo ejecutarse antes de este bloque.
     * En ese caso actualizamos la pantalla una sola vez.
     */
    function refreshAfterPatch() {

        try {

            if (state.user || state.guest) {
                renderApplication();
            }

        } catch (error) {

            console.error(
                '[SimuIPS] Error aplicando motor 3.0:',
                error
            );
        }
    }

    if (document.readyState === 'loading') {

        document.addEventListener(
            'DOMContentLoaded',
            refreshAfterPatch,
            { once: true }
        );

    } else {

        refreshAfterPatch();
    }

    console.log(
        '%cSimuIPS 3.0',
        'font-weight:700;font-size:16px;',
        'motor preparado para ISS/CUPS/CIE-10/CUM.'
    );

})();


/* ============================================================
   SIMUIPS — PRÁCTICA ISS ÚNICA
   ------------------------------------------------------------
   La aplicación ya no utiliza Auditoría ni modo automático.
   La entrada de práctica es única y siempre corresponde a:
       PRÁCTICA ISS -> LIQUIDACIÓN ISS -> VALIDACIÓN
   Se conserva el motor existente para no romper catálogos,
   actividades, progreso ni el validador ISS.
   ============================================================ */

(function installISSOnlyMode() {

    /* --------------------------------------------------------
       MODO ÚNICO
    -------------------------------------------------------- */

    state.currentMode = 'manual';

    const originalStartPracticeCaseOnly =
        startPracticeCase;

    startPracticeCase = async function startPracticeCaseISSOnly() {

        return originalStartPracticeCaseOnly('manual');

    };


    const originalRenderPracticeModeOnly =
        renderPracticeMode;

    renderPracticeMode = function renderPracticeModeISSOnly() {

        state.currentMode = 'manual';

        return originalRenderPracticeModeOnly('manual');

    };


    if (typeof startStudentPractice === 'function') {

        const originalStartStudentPracticeOnly =
            startStudentPractice;

        startStudentPractice = async function startStudentPracticeISSOnly() {

            return originalStartStudentPracticeOnly('manual');

        };

    }


    if (typeof resetPracticeState === 'function') {

        const originalResetPracticeStateOnly =
            resetPracticeState;

        resetPracticeState = function resetPracticeStateISSOnly() {

            return originalResetPracticeStateOnly('manual');

        };

    }


    /* --------------------------------------------------------
       INVITADO
       -------------------------------------------------------- */

    const originalStartGuestOnly =
        startGuest;

    startGuest = function startGuestISSOnly() {

        return originalStartGuestOnly('manual');

    };


    /* --------------------------------------------------------
       ACTIVIDADES
       --------------------------------------------------------
       Las actividades pueden seguir existiendo para el docente,
       pero al entrar al ejercicio ya no existe una ruta automática.
       -------------------------------------------------------- */

    const originalStartGuestActivityOnly =
        startGuestActivity;

    startGuestActivity = function startGuestActivityISSOnly(
        activityId
    ) {

        const result =
            originalStartGuestActivityOnly(
                activityId
            );

        state.currentMode = 'manual';

        if (state.guestState) {

            state.guestState.mode =
                'manual';

        }

        saveGuestSession();

        if (state.page === 'billing') {

            renderBillingPage();

        }

        return result;

    };


    /* --------------------------------------------------------
       SESIÓN INVITADO RESTAURADA
       -------------------------------------------------------- */

    const originalRestoreGuestSessionOnly =
        restoreGuestSession;

    restoreGuestSession = function restoreGuestSessionISSOnly() {

        const restored =
            originalRestoreGuestSessionOnly();

        if (restored) {

            state.currentMode = 'manual';

            if (state.guestState) {

                state.guestState.mode =
                    'manual';

            }

        }

        return restored;

    };


    /* --------------------------------------------------------
       NAVEGACIÓN
       -------------------------------------------------------- */

    const originalCanAccessPageOnly =
        canAccessPage;

    canAccessPage = function canAccessPageISSOnly(
        page
    ) {

        if (
            page === 'automatic-mode'
        ) {

            return false;

        }

        return originalCanAccessPageOnly(
            page
        );

    };


    /* --------------------------------------------------------
       SIDEBAR
       --------------------------------------------------------
       El HTML nuevo ya no contiene Auditoría, pero el JS antiguo
       todavía podía generarla dinámicamente. Se elimina cualquier
       elemento residual después de pintar el menú.
       -------------------------------------------------------- */

    const originalRenderSidebarOnly =
        renderSidebar;

    renderSidebar = function renderSidebarISSOnly() {

        originalRenderSidebarOnly();

        document
            .querySelectorAll(
                '[data-page="automatic-mode"]'
            )
            .forEach(
                element => element.remove()
            );

    };


    /* --------------------------------------------------------
       NOMBRE DE PÁGINA
       -------------------------------------------------------- */

    const originalUpdateCurrentPageNameOnly =
        updateCurrentPageName;

    updateCurrentPageName =
        function updateCurrentPageNameISSOnly() {

            originalUpdateCurrentPageNameOnly();

            const current =
                $('current-page-name');

            if (
                current &&
                normalize(current.textContent)
                    .includes('auditoria')
            ) {

                current.textContent =
                    'Práctica ISS';

            }

        };


    /* --------------------------------------------------------
       LIQUIDACIÓN
       --------------------------------------------------------
       Nunca permitir que un estado antiguo vuelva a activar
       automatic-mode.
       -------------------------------------------------------- */

    const originalRenderBillingPageOnly =
        renderBillingPage;

    renderBillingPage =
        function renderBillingPageISSOnly() {

            state.currentMode = 'manual';

            return originalRenderBillingPageOnly();

        };


    /* --------------------------------------------------------
       CONTROLES DE MODO
       --------------------------------------------------------
       Si existe algún control heredado en una versión anterior
       del HTML, se elimina. El HTML nuevo no depende de ellos.
       -------------------------------------------------------- */

    function removeLegacyBillingModeControls() {

        document
            .querySelectorAll(
                '[data-billing-mode], ' +
                '.billing-mode-button, ' +
                '.billing-mode-selector'
            )
            .forEach(
                element => element.remove()
            );

    }


    /* --------------------------------------------------------
       REFUERZO DESPUÉS DE CADA NAVEGACIÓN
       -------------------------------------------------------- */

    const originalNavigateISSOnly =
        navigate;

    navigate = function navigateISSOnly(
        page
    ) {

        if (
            page === 'automatic-mode'
        ) {

            page = 'manual-mode';

        }

        state.currentMode =
            page === 'billing'
                ? 'manual'
                : state.currentMode;

        originalNavigateISSOnly(
            page
        );

        if (
            page === 'manual-mode' ||
            page === 'billing'
        ) {

            state.currentMode =
                'manual';

            removeLegacyBillingModeControls();

        }

    };


    /* --------------------------------------------------------
       LIMPIEZA DE CUALQUIER ESTADO AUTOMÁTICO ANTIGUO
       -------------------------------------------------------- */

    if (
        state.currentMode === 'automatic'
    ) {

        state.currentMode =
            'manual';

    }

    removeLegacyBillingModeControls();


    console.log(
        '[SimuIPS] Modo único activo: Práctica ISS.'
    );

})();


/* ============================================================
   SIMUIPS — AJUSTES DE NAVEGACIÓN / PERFIL
   - Unirme a actividad visible en el menú lateral.
   - El botón del perfil superior deja de abrir un menú duplicado.
   - Configuración y cierre de sesión quedan únicamente en el
     menú lateral, como corresponde al diseño actual.
============================================================ */

(function installNavigationCleanupV2() {

    'use strict';

    /*
     * El menú lateral es la única fuente de estas acciones.
     * Evitamos que el botón "Invitado / Usuario" abra un segundo
     * menú con Configuración / Cerrar sesión.
     */
    function disableDuplicatedUserMenu() {

        const button =
            $('user-menu-button');

        const dropdown =
            $('user-menu-dropdown');

        if (dropdown) {

            dropdown.classList.add('hidden');

            dropdown.setAttribute(
                'aria-hidden',
                'true'
            );

            dropdown.style.display =
                'none';

        }

        if (button) {

            button.setAttribute(
                'aria-expanded',
                'false'
            );

            button.setAttribute(
                'aria-haspopup',
                'false'
            );

            button.style.cursor =
                'default';

            button.style.pointerEvents =
                'none';

            button.title =
                'Las opciones de cuenta están disponibles en el menú lateral.';

        }

    }


    /*
     * Agrega "Unirme a actividad" al menú lateral sin depender
     * de que el HTML lo haya dejado visible.
     *
     * Se coloca después de "Mis actividades" cuando existe.
     * Para invitado también se muestra porque las actividades
     * pueden permitir acceso de invitado.
     */
    function ensureJoinActivityNavItem() {

        const nav =
            $('sidebar-nav');

        if (!nav) {
            return;
        }

        const existing =
            nav.querySelector(
                '[data-page="join-activity"]'
            );

        if (existing) {
            return;
        }

        /*
         * Solo estudiantes e invitados necesitan esta entrada.
         * Los profesores administran actividades desde Docencia.
         */
        if (
            !isGuest() &&
            state.user?.role !== 'student'
        ) {
            return;
        }

        const item =
            document.createElement('button');

        item.type =
            'button';

        item.className =
            'nav-item';

        item.dataset.page =
            'join-activity';

        item.innerHTML = `
            <span class="nav-icon">+</span>
            <span>Unirme a actividad</span>
        `;

        const activitiesButton =
            nav.querySelector(
                '[data-page="student-activities"]'
            );

        const manualButton =
            nav.querySelector(
                '[data-page="manual-mode"]'
            );

        if (activitiesButton) {

            activitiesButton.insertAdjacentElement(
                'afterend',
                item
            );

        } else if (manualButton) {

            manualButton.insertAdjacentElement(
                'beforebegin',
                item
            );

        } else {

            nav.appendChild(item);

        }

    }


    /*
     * renderSidebar() se ejecuta cada vez que cambia la página,
     * así que envolvemos la función para que el botón permanezca.
     */
    const originalRenderSidebarV2 =
        renderSidebar;

    renderSidebar =
        function renderSidebarWithJoinActivityV2() {

            originalRenderSidebarV2();

            ensureJoinActivityNavItem();

            disableDuplicatedUserMenu();

        };


    /*
     * Aplicar inmediatamente al estado actual.
     */
    ensureJoinActivityNavItem();

    disableDuplicatedUserMenu();


    /*
     * Si alguna parte del HTML intenta volver a mostrar el
     * dropdown del perfil, lo ocultamos de nuevo.
     */
    document.addEventListener(
        'click',
        event => {

            const profileButton =
                event.target.closest(
                    '#user-menu-button'
                );

            if (profileButton) {

                event.preventDefault();
                event.stopImmediatePropagation();

                disableDuplicatedUserMenu();

            }

        },
        true
    );


    console.log(
        '[SimuIPS] Navegación V2 activa: perfil duplicado eliminado y "Unirme a actividad" habilitado.'
    );

})();

/* ============================================================
   SIMUIPS — CORRECCIÓN FINAL: UNIRSE A ACTIVIDAD + RESULTADO
   - Invitado: "Unirme a actividad" abre el cuadro de código.
   - Evita el mensaje "No tienes acceso a esta sección".
   - La tarjeta de resultado permanece oculta hasta validar.
============================================================ */

(function installJoinActivityAndValidationStateFix() {

    'use strict';

    function openJoinActivityDialog() {

        const modal =
            $('guest-activity-modal');

        if (!modal) {
            return false;
        }

        openModal(
            'guest-activity-modal'
        );

        const input =
            $('guest-activity-code');

        input?.focus();

        return true;

    }


    /* --------------------------------------------------------
       INVITADO: la página join-activity sí es accesible.
       Aun así, el botón lateral abre directamente el modal,
       que es la experiencia mostrada en el diseño.
    -------------------------------------------------------- */

    const previousCanAccessJoinFix =
        canAccessPage;

    canAccessPage = function canAccessPageJoinFix(page) {

        if (
            isGuest() &&
            page === 'join-activity'
        ) {
            return true;
        }

        return previousCanAccessJoinFix(page);

    };


    /* --------------------------------------------------------
       BOTÓN LATERAL "UNIRME A ACTIVIDAD"
    -------------------------------------------------------- */

    function bindJoinActivityButtons() {

        document
            .querySelectorAll(
                '#sidebar-nav [data-page="join-activity"]'
            )
            .forEach(button => {

                if (
                    button.dataset.joinActivityFixBound === '1'
                ) {
                    return;
                }

                button.dataset.joinActivityFixBound = '1';

                button.addEventListener(
                    'click',
                    event => {

                        if (isGuest()) {

                            event.preventDefault();
                            event.stopPropagation();

                            openJoinActivityDialog();

                        }

                    }
                );

            });

    }


    const previousRenderSidebarJoinFix =
        renderSidebar;

    renderSidebar =
        function renderSidebarJoinFix() {

            previousRenderSidebarJoinFix();

            bindJoinActivityButtons();

        };

    bindJoinActivityButtons();


    /* --------------------------------------------------------
       RESULTADO DE LIQUIDACIÓN
       Nunca debe aparecer simplemente al entrar al caso.
       Solo renderValidationResult() lo vuelve a mostrar después
       de pulsar "Validar liquidación".
    -------------------------------------------------------- */

    function hideBillingValidationUntilSubmit() {

        const card =
            $('billing-validation-card');

        if (!card) {
            return;
        }

        card.classList.add('hidden');
        card.setAttribute('aria-hidden', 'true');
        card.style.display = 'none';

    }


    const previousRenderBillingPageValidationFix =
        renderBillingPage;

    renderBillingPage =
        function renderBillingPageValidationFix() {

            hideBillingValidationUntilSubmit();

            const result =
                previousRenderBillingPageValidationFix();

            hideBillingValidationUntilSubmit();

            return result;

        };


    const previousStartActivityValidationFix =
        startActivity;

    startActivity =
        function startActivityValidationFix(activityId) {

            hideBillingValidationUntilSubmit();

            return previousStartActivityValidationFix(
                activityId
            );

        };


    const previousStartGuestActivityValidationFix =
        startGuestActivity;

    startGuestActivity =
        function startGuestActivityValidationFix(activityId) {

            hideBillingValidationUntilSubmit();

            return previousStartGuestActivityValidationFix(
                activityId
            );

        };


    const previousStartPracticeCaseValidationFix =
        startPracticeCase;

    startPracticeCase =
        async function startPracticeCaseValidationFix(
            mode = 'manual'
        ) {

            hideBillingValidationUntilSubmit();

            const result =
                await previousStartPracticeCaseValidationFix(
                    mode
                );

            hideBillingValidationUntilSubmit();

            return result;

        };


    /*
     * Al iniciar/re-renderizar una actividad, el resultado también
     * debe comenzar oculto aunque exista información de una sesión
     * anterior en el DOM.
     */
    hideBillingValidationUntilSubmit();

    console.log(
        '[SimuIPS] Corrección activa: Unirme a actividad abre el modal y el resultado queda oculto hasta validar.'
    );

})();


/* ============================================================
   SIMUIPS — CORRECCIÓN FINAL JS V4
   - El resultado de validación permanece oculto al entrar/re-renderizar.
   - Solo renderValidationResult() puede mostrarlo después de validar.
   - UVR / tarifa reciben validación visual en tiempo real:
       verde = correcto
       rojo  = incorrecto
       neutro = vacío
============================================================ */

(function installFinalISSValidationUIV4() {

    'use strict';


    /* --------------------------------------------------------
       RESULTADO: OCULTO POR DEFECTO
       --------------------------------------------------------
       No usamos únicamente .hidden porque otras reglas del
       proyecto pueden volver a pintar la tarjeta. Se fuerza
       display:none con !important.
    -------------------------------------------------------- */

    function hideValidationCardV4() {

        const card =
            $('billing-validation-card');

        if (!card) {
            return;
        }

        card.classList.add('hidden');

        card.setAttribute(
            'aria-hidden',
            'true'
        );

        card.style.setProperty(
            'display',
            'none',
            'important'
        );

    }


    /*
     * Al validar, renderValidationResult() es el único punto
     * autorizado para volver a mostrar la tarjeta.
     */
    const previousRenderValidationResultV4 =
        renderValidationResult;

    renderValidationResult =
        function renderValidationResultV4(
            correct,
            errors
        ) {

            const card =
                $('billing-validation-card');

            if (card) {

                card.classList.remove(
                    'hidden'
                );

                card.setAttribute(
                    'aria-hidden',
                    'false'
                );

                card.style.removeProperty(
                    'display'
                );

            }

            return previousRenderValidationResultV4(
                correct,
                errors
            );

        };


    /*
     * renderApplication() se ejecuta al cambiar de pantalla.
     * Después de pintar la liquidación dejamos el resultado
     * oculto. Así nunca aparece un resultado viejo al entrar
     * nuevamente a un caso.
     *
     * Importante: validar no llama renderApplication(), por lo
     * que el resultado sí puede aparecer después del botón.
     */
    const previousRenderApplicationV4 =
        renderApplication;

    renderApplication =
        function renderApplicationV4() {

            const result =
                previousRenderApplicationV4();

            if (
                state.page === 'billing'
            ) {

                hideValidationCardV4();

            }

            return result;

        };


    /*
     * También limpiamos explícitamente al renderizar la
     * liquidación y al iniciar un caso nuevo.
     */
    const previousRenderBillingPageV4 =
        renderBillingPage;

    renderBillingPage =
        function renderBillingPageV4() {

            hideValidationCardV4();

            const result =
                previousRenderBillingPageV4();

            hideValidationCardV4();

            return result;

        };


    /* --------------------------------------------------------
       VALIDACIÓN VISUAL DE UVR / TARIFA
    -------------------------------------------------------- */

    function setProcedureValueVisualStateV4(
        input,
        stateName
    ) {

        if (!input) {
            return;
        }

        input.classList.remove(
            'iss-field-valid',
            'iss-field-invalid'
        );

        input.style.transition =
            'border-color 0.15s ease, box-shadow 0.15s ease';

        if (stateName === 'valid') {

            input.classList.add(
                'iss-field-valid'
            );

            input.style.borderColor =
                '#16a34a';

            input.style.boxShadow =
                '0 0 0 2px rgba(22, 163, 74, 0.14)';

        } else if (
            stateName === 'invalid'
        ) {

            input.classList.add(
                'iss-field-invalid'
            );

            input.style.borderColor =
                '#dc2626';

            input.style.boxShadow =
                '0 0 0 2px rgba(220, 38, 38, 0.14)';

        } else {

            input.style.borderColor = '';
            input.style.boxShadow = '';

        }

    }


    function parseISSNumericValue(value) {

        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : NaN;
        }

        const raw =
            String(value ?? '')
                .trim();

        if (!raw) {
            return NaN;
        }

        /*
         * La UVR puede venir como número o como texto, por ejemplo:
         * 375, "375 UVR" o "375 uvr".
         * No usamos numberValue() aquí porque ese conversor exige
         * que toda la cadena sea numérica y en ese caso devolvería 0.
         */
        const match =
            raw.replace(/\s/g, '')
                .match(/-?\d+(?:[.,]\d+)?/);

        if (!match) {
            return NaN;
        }

        return Number(
            match[0].replace(',', '.')
        );
    }


    function updateProcedureValueVisualStateV4(
        caseData
    ) {

        if (!caseData) {
            return;
        }

        const solution =
            issSolution(caseData);

        if (!solution) {
            return;
        }

        const type =
            issType(caseData);

        const fieldName =
            type === 'direct'
                ? 'procedure-value'
                : 'procedure-uvr';

        const input =
            document.querySelector(
                `#manual-concepts [data-iss-field="${fieldName}"]`
            );

        if (!input) {
            return;
        }

        const raw =
            String(
                input.value ?? ''
            ).trim();

        if (!raw) {

            setProcedureValueVisualStateV4(
                input,
                'neutral'
            );

            return;

        }

        const received =
            parseISSNumericValue(raw);

        const expected =
            type === 'direct'
                ? parseISSNumericValue(solution.tariff)
                : parseISSNumericValue(solution.uvr);

        /*
         * Si la fuente no define el valor, no inventamos una
         * comparación ni marcamos el campo como correcto.
         */
        if (
            !Number.isFinite(expected) ||
            expected <= 0
        ) {

            setProcedureValueVisualStateV4(
                input,
                'neutral'
            );

            return;

        }

        setProcedureValueVisualStateV4(
            input,
            Math.abs(
                received - expected
            ) <= 0.01
                ? 'valid'
                : 'invalid'
        );

    }


    function bindProcedureValueVisualStateV4() {

        document
            .querySelectorAll(
                '#manual-concepts [data-iss-field="procedure-uvr"], ' +
                '#manual-concepts [data-iss-field="procedure-value"]'
            )
            .forEach(input => {

                if (
                    input.dataset.simuipsValueVisualBound === '1'
                ) {
                    updateProcedureValueVisualStateV4(
                        state.currentCase
                    );
                    return;
                }

                input.dataset.simuipsValueVisualBound =
                    '1';

                input.addEventListener(
                    'input',
                    () => {

                        updateProcedureValueVisualStateV4(
                            state.currentCase
                        );

                    }
                );

                input.addEventListener(
                    'change',
                    () => {

                        updateProcedureValueVisualStateV4(
                            state.currentCase
                        );

                    }
                );

                updateProcedureValueVisualStateV4(
                    state.currentCase
                );

            });

    }


    /*
     * Cada vez que se reconstruye la tabla ISS, los campos son
     * nuevos. Por eso se vuelve a enlazar después de renderizar.
     */
    const previousRenderBillingPageValueV4 =
        renderBillingPage;

    renderBillingPage =
        function renderBillingPageValueV4() {

            const result =
                previousRenderBillingPageValueV4();

            bindProcedureValueVisualStateV4();
            updateProcedureValueVisualStateV4(
                state.currentCase
            );

            return result;

        };


    /*
     * Al iniciar un caso nuevo, limpiar cualquier estado visual
     * heredado y dejar los campos recién creados en neutro.
     */
    const previousStartPracticeCaseValueV4 =
        startPracticeCase;

    startPracticeCase =
        async function startPracticeCaseValueV4(
            mode = 'manual'
        ) {

            const result =
                await previousStartPracticeCaseValueV4(
                    'manual'
                );

            hideValidationCardV4();

            bindProcedureValueVisualStateV4();
            updateProcedureValueVisualStateV4(
                state.currentCase
            );

            return result;

        };


    /*
     * El código ya tenía su propia validación visual. Después
     * de cada render de la liquidación la sincronizamos junto
     * con UVR/tarifa.
     */
    bindProcedureValueVisualStateV4();
    updateProcedureValueVisualStateV4(
        state.currentCase
    );

    hideValidationCardV4();


    console.log(
        '[SimuIPS] V4 activa: resultado oculto hasta validar + UVR/tarifa con estado visual.'
    );

})();


/* ============================================================
   CORRECCIONES FINALES — SIMUIPS
   - Salir de práctica funcional para invitado.
   - UVR/tarifa con validación visual inmediata.
   - Elimina Auditoría del sidebar.
   - Renombra Práctica manual -> Práctica ISS.
============================================================ */

(function installFinalCorrectionsV2() {

    /* --------------------------------------------------------
       1. SALIR DE PRÁCTICA
       El botón #logout-button se genera/actualiza desde
       renderSidebar(), por lo que usamos delegación de eventos.
    -------------------------------------------------------- */

    document.addEventListener(
        'click',
        function simuipsLogoutButtonHandler(event) {

            const button =
                event.target.closest('#logout-button');

            if (!button) {
                return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();

            logout();
        },
        true
    );


    /* --------------------------------------------------------
       2. VALIDACIÓN VISUAL DE UVR / TARIFA
       No depende del binding anterior. Se escucha directamente
       el input y funciona aunque la tabla haya sido reconstruida.
    -------------------------------------------------------- */

    function normalizeISSNumber(raw) {
        let value = String(raw ?? '')
            .trim()
            .replace(/[\s$]/g, '')
            .replace(/[^0-9,.-]/g, '');

        if (!value) return NaN;

        const lastComma = value.lastIndexOf(',');
        const lastDot = value.lastIndexOf('.');

        // Si hay punto y coma, el último separador es el decimal:
        // 2.750,50 -> 2750.50; 2,750.50 -> 2750.50.
        if (lastComma !== -1 && lastDot !== -1) {
            const decimalSeparator = lastComma > lastDot ? ',' : '.';
            const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
            value = value.split(thousandsSeparator).join('');
            if (decimalSeparator === ',') value = value.replace(',', '.');
        } else if (lastComma !== -1 || lastDot !== -1) {
            const separator = lastComma !== -1 ? ',' : '.';
            const index = value.lastIndexOf(separator);
            const digitsAfter = value.length - index - 1;

            // En formato colombiano, 2.750 y 2,750 representan 2750.
            // Con 1 o 2 cifras después del separador se admite decimal.
            if (digitsAfter === 3) {
                value = value.split(separator).join('');
            } else if (separator === ',') {
                value = value.replace(',', '.');
            }
        }

        const number = Number(value);
        return Number.isFinite(number) ? number : NaN;
    }

    function setFinalISSValueState(
        input,
        stateName
    ) {

        if (!input) {
            return;
        }

        input.classList.remove(
            'iss-field-valid',
            'iss-field-invalid'
        );

        if (stateName === 'valid') {

            input.classList.add(
                'iss-field-valid'
            );

            input.style.setProperty(
                'border-color',
                '#16a34a',
                'important'
            );

            input.style.setProperty(
                'box-shadow',
                '0 0 0 2px rgba(22,163,74,.14)',
                'important'
            );

            return;
        }

        if (stateName === 'invalid') {

            input.classList.add(
                'iss-field-invalid'
            );

            input.style.setProperty(
                'border-color',
                '#dc2626',
                'important'
            );

            input.style.setProperty(
                'box-shadow',
                '0 0 0 2px rgba(220,38,38,.14)',
                'important'
            );

            return;
        }

        input.style.removeProperty(
            'border-color'
        );

        input.style.removeProperty(
            'box-shadow'
        );
    }


    function getFinalISSExpectedValue() {

        const currentCase =
            state.currentCase;

        if (!currentCase) {
            return null;
        }

        const solution =
            typeof issSolution === 'function'
                ? issSolution(currentCase)
                : null;

        if (!solution) {
            return null;
        }

        const type =
            typeof issType === 'function'
                ? issType(currentCase)
                : 'uvr';

        if (type === 'direct') {

            const tariff =
                normalizeISSNumber(
                    solution.tariff
                );

            return Number.isFinite(tariff)
                ? {
                    field: 'procedure-value',
                    expected: tariff
                }
                : null;
        }

        const uvr =
            normalizeISSNumber(
                solution.uvr
            );

        return Number.isFinite(uvr)
            ? {
                field: 'procedure-uvr',
                expected: uvr
            }
            : null;
    }


    function updateFinalISSValueState(input) {

        if (!input) {
            return;
        }

        const expectedData =
            getFinalISSExpectedValue();

        if (!expectedData) {
            setFinalISSValueState(
                input,
                'neutral'
            );
            return;
        }

        if (
            input.dataset.issField !==
            expectedData.field
        ) {
            return;
        }

        const raw =
            String(
                input.value ?? ''
            ).trim();

        if (!raw) {
            setFinalISSValueState(
                input,
                'neutral'
            );
            return;
        }

        const received =
            normalizeISSNumber(raw);

        if (!Number.isFinite(received)) {
            setFinalISSValueState(
                input,
                'invalid'
            );
            return;
        }

        const isCorrect =
            Math.abs(
                received -
                expectedData.expected
            ) <= 0.01;

        setFinalISSValueState(
            input,
            isCorrect
                ? 'valid'
                : 'invalid'
        );
    }


    function syncFinalISSValueFields() {

        document
            .querySelectorAll(
                '#manual-concepts [data-iss-field="procedure-uvr"], ' +
                '#manual-concepts [data-iss-field="procedure-value"]'
            )
            .forEach(
                updateFinalISSValueState
            );
    }


    document.addEventListener(
        'input',
        function simuipsISSValueInputHandler(event) {

            const input =
                event.target.closest(
                    '#manual-concepts [data-iss-field="procedure-uvr"], ' +
                    '#manual-concepts [data-iss-field="procedure-value"]'
                );

            if (!input) {
                return;
            }

            updateFinalISSValueState(
                input
            );
        }
    );


    document.addEventListener(
        'change',
        function simuipsISSValueChangeHandler(event) {

            const input =
                event.target.closest(
                    '#manual-concepts [data-iss-field="procedure-uvr"], ' +
                    '#manual-concepts [data-iss-field="procedure-value"]'
                );

            if (!input) {
                return;
            }

            updateFinalISSValueState(
                input
            );
        }
    );


    /* --------------------------------------------------------
       3. SIDEBAR: SOLO PRÁCTICA ISS
    -------------------------------------------------------- */

    const previousRenderSidebarFinal =
        renderSidebar;

    renderSidebar =
        function renderSidebarFinalCorrections() {

            const result =
                previousRenderSidebarFinal();

            document
                .querySelectorAll(
                    '[data-page="automatic-mode"]'
                )
                .forEach(
                    element => element.remove()
                );

            document
                .querySelectorAll(
                    '[data-page="manual-mode"]'
                )
                .forEach(
                    element => {

                        const label =
                            element.querySelector(
                                'span:last-child'
                            );

                        if (label) {
                            label.textContent =
                                'Práctica ISS';
                        }
                    }
                );

            const nav =
                $('sidebar-nav');

            if (nav) {

                nav.querySelectorAll(
                    'button, a'
                ).forEach(
                    element => {

                        if (
                            normalize(
                                element.textContent
                            ).includes(
                                'auditoria'
                            )
                        ) {
                            element.remove();
                        }
                    }
                );
            }

            return result;
        };


    /* --------------------------------------------------------
       4. SI SE CAMBIA DE PANTALLA Y SE RECONSTRUYE LA TABLA,
          VOLVEMOS A SINCRONIZAR EL ESTADO DEL UVR.
    -------------------------------------------------------- */

    const previousRenderApplicationFinal =
        renderApplication;

    renderApplication =
        function renderApplicationFinalCorrections() {

            const result =
                previousRenderApplicationFinal();

            if (
                state.page === 'billing'
            ) {
                setTimeout(
                    syncFinalISSValueFields,
                    0
                );
            }

            return result;
        };


    syncFinalISSValueFields();

    console.log(
        '[SimuIPS] Correcciones finales V2 activas.'
    );

})();


/* ============================================================
   FIX DEFINITIVO VISUAL V3
   - Estilo compacto del título del caso.
   - Validación visual robusta del campo UVR/tarifa.
   - Usa el valor esperado del caso ISS, no el texto del input.
============================================================ */
(function installVisualFixV3() {
    const styleId = 'simuips-visual-fix-v3';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #provided-case-name {
                font-size: 18px !important;
                line-height: 1.28 !important;
                font-weight: 750 !important;
                letter-spacing: -0.02em !important;
                margin: 2px 0 0 !important;
                max-width: 100% !important;
                overflow-wrap: anywhere !important;
            }
            #provided-case-name * {
                font-size: inherit !important;
                line-height: inherit !important;
            }
            .iss-table-input.iss-field-valid,
            input.iss-field-valid {
                border: 1px solid #16a34a !important;
                box-shadow: 0 0 0 2px rgba(22,163,74,.18) !important;
                outline: none !important;
            }
            .iss-table-input.iss-field-invalid,
            input.iss-field-invalid {
                border: 1px solid #dc2626 !important;
                box-shadow: 0 0 0 2px rgba(220,38,38,.18) !important;
                outline: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function numeric(raw) {
        let s = String(raw ?? '').trim().replace(/\s/g, '').replace(/\$/g, '');
        if (!s) return NaN;
        if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
        else if (s.includes(',')) s = s.replace(',', '.');
        const n = Number(s);
        return Number.isFinite(n) ? n : NaN;
    }

    function getCaseSolution() {
        const c = state.currentCase;
        if (!c) return null;
        try {
            if (typeof issSolution === 'function') {
                const s = issSolution(c);
                if (s) return s;
            }
        } catch (_) {}
        return c.issSolution || c.solution || c.procedure?.issSolution || null;
    }

    function getExpectedForInput(input) {
        const solution = getCaseSolution();
        if (!solution) return NaN;

        const field = input.dataset.issField || '';
        if (field === 'procedure-value') {
            return numeric(
                solution.tariff ??
                solution.value ??
                solution.directValue ??
                solution.liquidation?.procedure?.unitValue ??
                solution.liquidation?.service?.unitValue
            );
        }

        return numeric(
            solution.uvr ??
            solution.UVR ??
            solution.procedureUVR ??
            solution.procedure?.uvr
        );
    }

    function paint(input, status) {
        if (!input) return;
        input.classList.remove('iss-field-valid', 'iss-field-invalid');
        input.style.setProperty('transition', 'border-color .12s ease, box-shadow .12s ease', 'important');

        if (status === 'valid') {
            input.classList.add('iss-field-valid');
            input.style.setProperty('border-color', '#16a34a', 'important');
            input.style.setProperty('box-shadow', '0 0 0 2px rgba(22,163,74,.18)', 'important');
        } else if (status === 'invalid') {
            input.classList.add('iss-field-invalid');
            input.style.setProperty('border-color', '#dc2626', 'important');
            input.style.setProperty('box-shadow', '0 0 0 2px rgba(220,38,38,.18)', 'important');
        } else {
            input.style.removeProperty('border-color');
            input.style.removeProperty('box-shadow');
        }
    }

    function update(input) {
        if (!input) return;
        const raw = String(input.value ?? '').trim();
        if (!raw) {
            paint(input, 'neutral');
            return;
        }

        const expected = getExpectedForInput(input);
        const entered = numeric(raw);

        if (!Number.isFinite(expected) || expected <= 0 || !Number.isFinite(entered)) {
            paint(input, Number.isFinite(entered) ? 'neutral' : 'invalid');
            return;
        }

        paint(input, Math.abs(entered - expected) <= 0.01 ? 'valid' : 'invalid');
    }

    function sync() {
        document.querySelectorAll(
            '#manual-concepts [data-iss-field="procedure-uvr"],' +
            '#manual-concepts [data-iss-field="procedure-value"]'
        ).forEach(update);
    }

    // Delegación: funciona aunque la tabla se destruya y se vuelva a crear.
    document.addEventListener('input', event => {
        const input = event.target.closest(
            '#manual-concepts [data-iss-field="procedure-uvr"],' +
            '#manual-concepts [data-iss-field="procedure-value"]'
        );
        if (input) update(input);
    }, true);

    document.addEventListener('change', event => {
        const input = event.target.closest(
            '#manual-concepts [data-iss-field="procedure-uvr"],' +
            '#manual-concepts [data-iss-field="procedure-value"]'
        );
        if (input) update(input);
    }, true);

    // Reaplica al navegar o cuando se renderiza un caso nuevo.
    const oldRenderBillingPage = renderBillingPage;
    renderBillingPage = function renderBillingPageVisualFixV3() {
        const result = oldRenderBillingPage();
        requestAnimationFrame(sync);
        setTimeout(sync, 60);
        return result;
    };

    const oldStartPracticeCase = startPracticeCase;
    startPracticeCase = async function startPracticeCaseVisualFixV3(mode = 'manual') {
        const result = await oldStartPracticeCase('manual');
        requestAnimationFrame(sync);
        setTimeout(sync, 60);
        return result;
    };

    sync();
    setTimeout(sync, 60);
    console.log('[SimuIPS] Fix visual V3 activo.');
})();


/* ============================================================
   SIMUIPS HOTFIX — CORRECCIONES BASADAS EN EL HTML REAL
   1) El botón de inicio de práctica inicia el caso y abre Liquidación.
   2) Iniciar sesión abre el formulario real, no la advertencia de invitado.
   3) El contador cuenta casos distintos intentados, no intentos repetidos.
   4) El título del caso usa el ID real #exercise-name.
   5) UVR/tarifa se pinta de forma inmediata con estilos prioritarios.
============================================================ */
(function installSimuIPSRealHTMLHotfix() {
    const styleId = 'simuips-real-html-hotfix';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #exercise-name {
                font-size: 20px !important;
                line-height: 1.28 !important;
                font-weight: 750 !important;
                letter-spacing: -0.025em !important;
                margin: 2px 0 0 !important;
                max-width: 100% !important;
                overflow-wrap: anywhere !important;
            }
            #exercise-description {
                font-size: 13px !important;
                line-height: 1.5 !important;
                margin-top: 3px !important;
            }
            .practice-iss-only-grid {
                grid-template-columns: minmax(0, 1fr) !important;
                max-width: 820px !important;
            }
            #manual-concepts [data-iss-field="procedure-uvr"].iss-field-valid,
            #manual-concepts [data-iss-field="procedure-value"].iss-field-valid {
                border: 1px solid #16a34a !important;
                border-color: #16a34a !important;
                box-shadow: 0 0 0 2px rgba(22,163,74,.18) !important;
                outline: none !important;
            }
            #manual-concepts [data-iss-field="procedure-uvr"].iss-field-invalid,
            #manual-concepts [data-iss-field="procedure-value"].iss-field-invalid {
                border: 1px solid #dc2626 !important;
                border-color: #dc2626 !important;
                box-shadow: 0 0 0 2px rgba(220,38,38,.18) !important;
                outline: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function parseISSNumber(raw) {
        let value = String(raw ?? '')
            .trim()
            .replace(/[\s$]/g, '')
            .replace(/[^0-9,.-]/g, '');
        if (!value) return NaN;

        const lastComma = value.lastIndexOf(',');
        const lastDot = value.lastIndexOf('.');

        if (lastComma !== -1 && lastDot !== -1) {
            const decimalSeparator = lastComma > lastDot ? ',' : '.';
            const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
            value = value.split(thousandsSeparator).join('');
            if (decimalSeparator === ',') value = value.replace(',', '.');
        } else if (lastComma !== -1 || lastDot !== -1) {
            const separator = lastComma !== -1 ? ',' : '.';
            const index = value.lastIndexOf(separator);
            const digitsAfter = value.length - index - 1;

            // 2.750 / 2,750 = 2750 en formato de miles.
            if (digitsAfter === 3) {
                value = value.split(separator).join('');
            } else if (separator === ',') {
                value = value.replace(',', '.');
            }
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : NaN;
    }

    function getCurrentSolution() {
        if (!state.currentCase) return null;
        try {
            if (typeof issSolution === 'function') {
                const solution = issSolution(state.currentCase);
                if (solution) return solution;
            }
        } catch (_) {}
        return state.currentCase.issSolution ||
            state.currentCase.solution ||
            null;
    }

    function setInputState(input, status) {
        if (!input) return;
        input.classList.remove('iss-field-valid', 'iss-field-invalid');
        if (status === 'valid') {
            input.classList.add('iss-field-valid');
            input.style.setProperty('border', '1px solid #16a34a', 'important');
            input.style.setProperty('border-color', '#16a34a', 'important');
            input.style.setProperty('box-shadow', '0 0 0 2px rgba(22,163,74,.18)', 'important');
        } else if (status === 'invalid') {
            input.classList.add('iss-field-invalid');
            input.style.setProperty('border', '1px solid #dc2626', 'important');
            input.style.setProperty('border-color', '#dc2626', 'important');
            input.style.setProperty('box-shadow', '0 0 0 2px rgba(220,38,38,.18)', 'important');
        } else {
            input.style.removeProperty('border');
            input.style.removeProperty('border-color');
            input.style.removeProperty('box-shadow');
        }
    }

    function updateValueInput(input) {
        if (!input) return;
        const field = input.dataset.issField;
        if (field !== 'procedure-uvr' && field !== 'procedure-value') return;

        const raw = String(input.value ?? '').trim();
        if (!raw) {
            setInputState(input, 'neutral');
            return;
        }

        const solution = getCurrentSolution();
        if (!solution) {
            setInputState(input, 'neutral');
            return;
        }

        const expectedRaw = field === 'procedure-value'
            ? (solution.tariff ?? solution.value ??
               solution.directValue ??
               solution.liquidation?.procedure?.unitValue ??
               solution.liquidation?.service?.unitValue)
            : (solution.uvr ?? solution.UVR ?? solution.procedureUVR);

        const expected = parseISSNumber(expectedRaw);
        const entered = parseISSNumber(raw);

        if (!Number.isFinite(entered)) {
            setInputState(input, 'invalid');
            return;
        }
        if (!Number.isFinite(expected) || expected <= 0) {
            setInputState(input, 'neutral');
            return;
        }

        setInputState(input, Math.abs(entered - expected) <= 0.01 ? 'valid' : 'invalid');
    }

    function syncValueInputs() {
        document.querySelectorAll(
            '#manual-concepts [data-iss-field="procedure-uvr"],' +
            '#manual-concepts [data-iss-field="procedure-value"]'
        ).forEach(updateValueInput);
    }

    // Delegación en captura: también funciona cuando el JS reconstruye la tabla.
    document.addEventListener('input', event => {
        const input = event.target.closest(
            '#manual-concepts [data-iss-field="procedure-uvr"],' +
            '#manual-concepts [data-iss-field="procedure-value"]'
        );
        if (input) updateValueInput(input);
    }, true);

    document.addEventListener('change', event => {
        const input = event.target.closest(
            '#manual-concepts [data-iss-field="procedure-uvr"],' +
            '#manual-concepts [data-iss-field="procedure-value"]'
        );
        if (input) updateValueInput(input);
    }, true);

    // Corrige el botón "Iniciar sesión" de la barra lateral en modo invitado.
    // El listener antiguo abría la advertencia "No pierdas tu progreso".
    document.addEventListener('click', event => {
        const loginButton = event.target.closest('#sidebar-login-button');
        if (!loginButton) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        closeModal('guest-exit-warning-modal');
        openModal('login-modal');
        setTimeout(() => $('login-email')?.focus(), 30);
    }, true);

    // El botón de práctica debe iniciar un caso real y navegar a Liquidación.
    document.addEventListener('click', async event => {
        const startButton = event.target.closest('#start-manual-practice');
        if (!startButton) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        startButton.disabled = true;
        try {
            state.currentMode = 'manual';
            const result = await startPracticeCase('manual');
            if (result || state.currentCase) {
                navigate('billing');
                requestAnimationFrame(syncValueInputs);
                setTimeout(syncValueInputs, 80);
            } else {
                navigate('manual-mode');
            }
        } catch (error) {
            console.error('[SimuIPS] No se pudo iniciar Práctica ISS:', error);
            toast('No se pudo iniciar la práctica. Revisa que data/cases.json cargue correctamente con Live Server.', 'error');
        } finally {
            startButton.disabled = false;
        }
    }, true);

    // Cuenta procedimientos/casos distintos que realmente tienen intentos registrados.
    function getUniqueAttemptedCases() {
        let attempts = [];
        try {
            if (typeof isGuest === 'function' && isGuest()) {
                attempts = readSession(APP.guest.attempts, []);
            } else {
                attempts = Array.isArray(state.history) ? state.history :
                    (Array.isArray(state.attempts) ? state.attempts : []);
            }
        } catch (_) {
            attempts = [];
        }
        if (!Array.isArray(attempts)) return 0;

        const keys = new Set();
        attempts.forEach(attempt => {
            const key = attempt?.caseId ||
                attempt?.case?.id ||
                attempt?.procedureCode ||
                attempt?.caseName;
            if (key !== undefined && key !== null && String(key).trim()) {
                keys.add(String(key).trim());
            }
        });
        return keys.size;
    }

    function refreshAccurateCaseCount() {
        const node = $('stat-cases');
        if (node) node.textContent = String(getUniqueAttemptedCases());
    }

    const previousRenderDashboard = renderDashboard;
    renderDashboard = function renderDashboardAccurateCount() {
        const result = previousRenderDashboard();
        refreshAccurateCaseCount();
        return result;
    };

    const previousRenderBillingPage = renderBillingPage;
    renderBillingPage = function renderBillingPageVisualSync() {
        const result = previousRenderBillingPage();
        requestAnimationFrame(syncValueInputs);
        setTimeout(syncValueInputs, 50);
        return result;
    };

    const previousStartPracticeCase = startPracticeCase;
    startPracticeCase = async function startPracticeCaseVisualSync(mode = 'manual') {
        const result = await previousStartPracticeCase('manual');
        requestAnimationFrame(syncValueInputs);
        setTimeout(syncValueInputs, 80);
        return result;
    };

    // CORRECCIÓN: no borrar tarjetas de práctica desde JavaScript.
    // El HTML debe conservar visibles los niveles normal y avanzado.

    syncValueInputs();
    refreshAccurateCaseCount();
    console.info('[SimuIPS] Hotfix basado en HTML real activo.');
})();


/* ============================================================
   HOTFIX DEFINITIVO — EXPOSICIÓN DE HELPERS ISS
   El motor ISS V4 declaró issSolution/issType dentro de un IIFE.
   Los parches posteriores los usan fuera de ese alcance.
   Se exponen aquí al ámbito global para evitar ReferenceError.
============================================================ */
(function exposeISSSolutionHelpers() {
    if (typeof window === 'undefined') return;

    window.issSolution = function issSolutionGlobal(caseData) {
        return caseData?.issSolution || {};
    };

    window.issType = function issTypeGlobal(caseData) {
        const solution = window.issSolution(caseData);
        if (
            String(solution.tariffType || '').toLowerCase() === 'direct' ||
            solution.tariff !== undefined ||
            solution.tariffValue !== undefined ||
            solution.value !== undefined
        ) {
            return 'direct';
        }

        if (
            solution.uvr !== undefined ||
            solution.UVR !== undefined ||
            solution.procedureUVR !== undefined
        ) {
            return 'uvr';
        }

        return 'uvr';
    };

    console.info('[SimuIPS] Helpers ISS expuestos globalmente.');
})();


/* ============================================================
   SIMUIPS — INICIO / ROLES / BÚSQUEDA V6
   - Invitado entra a Inicio, no inicia automáticamente una práctica.
   - "Unirse a actividad" vive en Inicio para invitado/estudiante.
   - Búsqueda global solo existe para profesor.
============================================================ */
(function installHomeRoleSearchV6() {
    'use strict';

    const styleId = 'simuips-home-role-search-v6';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .guest-home-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .global-search.simuips-search-hidden {
                display: none !important;
            }
            @media (max-width: 900px) {
                .guest-home-grid {
                    grid-template-columns: minmax(0, 1fr);
                }
            }
        `;
        document.head.appendChild(style);
    }

    function isTeacherUser() {
        return state.user?.role === 'teacher' && !state.guest;
    }

    function syncRoleSearch() {
        const search = $('global-search');
        if (!search) return;
        const wrapper = search.closest('.global-search');
        if (!wrapper) return;
        wrapper.classList.toggle('simuips-search-hidden', !isTeacherUser());
        if (!isTeacherUser()) {
            search.value = '';
            hide('global-search-results');
        }
    }

    /*
     * IMPORTANTE:
     * El startGuest original crea el caso y navega a billing.
     * Para el nuevo flujo de Inicio eso no debe suceder.
     * Esta versión inicializa la sesión invitada, pero deja al
     * usuario en Inicio hasta que pulse "Empezar práctica".
     */
    startGuest = function startGuestHomeV6() {
        state.guest = true;
        state.user = {
            id: `GUEST_${generateId('SESSION')}`,
            name: 'Invitado',
            lastname: '',
            role: 'student'
        };

        state.progress = readSession(
            APP.guest.progress,
            {
                xp: 0,
                level: 1,
                completedCases: 0,
                correctCases: 0,
                totalAttempts: 0,
                streak: 0
            }
        );

        state.currentMode = 'manual';
        state.currentCase = null;
        state.currentActivity = null;
        state.currentActivityCases = [];
        state.currentCaseIndex = 0;

        state.guestState = {
            id: state.user.id,
            startedAt: new Date().toISOString(),
            mode: 'manual',
            page: 'dashboard',
            currentCase: null,
            currentActivity: null
        };

        saveGuestSession();
        showApplication();

        /*
         * Inicio es la pantalla de entrada del invitado.
         * No se crea/carga ningún caso hasta que el usuario
         * pulse "Empezar práctica".
         */
        navigate('dashboard');
        syncRoleSearch();

        // Se omite el toast genérico: el acceso lleva directamente a Práctica ISS.
    };

    /*
     * Envolvemos la navegación para mantener la búsqueda
     * disponible únicamente para profesores.
     */
    const previousNavigateHomeV6 = navigate;
    navigate = function navigateHomeV6(page) {
        const result = previousNavigateHomeV6(page);
        requestAnimationFrame(syncRoleSearch);
        setTimeout(syncRoleSearch, 30);
        return result;
    };

    /*
     * Si el estado cambia por login/restore, actualizamos el
     * buscador sin alterar el resto de la aplicación.
     */
    const previousRenderApplicationHomeV6 = renderApplication;
    renderApplication = function renderApplicationHomeV6() {
        const result = previousRenderApplicationHomeV6();
        requestAnimationFrame(syncRoleSearch);
        return result;
    };

    syncRoleSearch();

    console.info(
        '[SimuIPS] V6: invitado inicia en Inicio + Unirse a actividad en Inicio + búsqueda solo docente.'
    );
})();


/* ============================================================
   SIMUIPS — SINCRONIZACIÓN DE TABLAS ISS CON EL INDEX NUEVO
   - UVR: conserva conceptos y controles originales.
   - Tarifa directa: muestra solo código, descripción y tarifa.
   - Reutiliza los controles del motor existente para no romper
     la validación ni el cálculo.
============================================================ */
(function syncISSBillingPanelsWithIndex() {
    'use strict';

    const uvrPanel = document.getElementById('uvr-liquidation-panel');
    const directPanel = document.getElementById('direct-tariff-panel');
    const concepts = document.getElementById('manual-concepts');
    const addConceptButton = document.getElementById('add-manual-concept');

    if (!uvrPanel || !directPanel || !concepts) {
        console.warn('[SimuIPS] No se encontraron los paneles ISS del index nuevo.');
        return;
    }

    const directList = directPanel.querySelector('.concepts-list');
    const originalDirectTable = directPanel.querySelector('.data-table-wrapper');
    const originalConceptsParent = concepts.parentElement;
    const originalConceptsNextSibling = concepts.nextSibling;

    function isDirectCase(caseData) {
        const solution = caseData?.issSolution || {};
        const declaredType = String(
            solution.tariffType ??
            caseData?.tariffType ??
            caseData?.billingType ??
            caseData?.liquidationType ??
            ''
        ).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

        if (/^(uvr|por uvr|liquidacion uvr)$/.test(declaredType)) return false;
        if (/^(direct|fixed|fixed tariff|tarifa fija|tarifa directa|pesos|cop)$/.test(declaredType)) return true;

        const liquidation = solution.liquidation || {};
        const hasUVRData =
            solution.uvr !== undefined ||
            caseData?.procedure?.uvr !== undefined ||
            Boolean(
                liquidation.surgeon ||
                liquidation.anesthesiologist ||
                liquidation.assistant ||
                liquidation.room ||
                liquidation.materials
            );
        if (hasUVRData) return false;

        return solution.tariff !== undefined ||
            solution.tariffValue !== undefined ||
            solution.value !== undefined ||
            liquidation.procedure?.unitValue !== undefined ||
            liquidation.service?.unitValue !== undefined;
    }

    function simplifyDirectTable() {
        const table = concepts.querySelector('.iss-table-direct');
        if (!table) return;

        const header = table.querySelector('thead tr');
        if (header) {
            header.innerHTML = '<th>Código</th><th>Descripción</th><th>Tarifa (COP)</th>';
        }

        table.querySelectorAll('tbody tr').forEach(row => {
            const cells = Array.from(row.children);
            // La tabla original tiene: código, descripción, UVR, tarifa, total.
            // Se retiran UVR y total; el resumen general conserva el total calculado.
            if (cells[4]) cells[4].remove();
            if (cells[2]) cells[2].remove();
        });

        // No mostramos instrucciones ni indicadores que no aportan a una tarifa directa.
        concepts.querySelectorAll('.iss-practice-intro').forEach(node => node.remove());
    }

    function restoreUVRPanel() {
        if (concepts.parentElement !== uvrPanel) {
            if (originalConceptsNextSibling && originalConceptsNextSibling.parentElement === uvrPanel) {
                uvrPanel.insertBefore(concepts, originalConceptsNextSibling);
            } else {
                uvrPanel.prepend(concepts);
            }
        }
        if (originalDirectTable && !directPanel.contains(originalDirectTable)) {
            if (directList) directList.appendChild(originalDirectTable);
        }
        uvrPanel.classList.remove('hidden');
        directPanel.classList.add('hidden');
        if (addConceptButton) addConceptButton.classList.remove('hidden');
    }

    function showDirectPanel(caseData) {
        // Evita duplicar el formulario estático: se usan los inputs reales del motor ISS.
        if (originalDirectTable?.parentElement) originalDirectTable.remove();
        if (concepts.parentElement !== directList) {
            directList?.appendChild(concepts);
        }
        simplifyDirectTable();
        uvrPanel.classList.add('hidden');
        directPanel.classList.remove('hidden');
        if (addConceptButton) addConceptButton.classList.add('hidden');
    }

    const previousRenderBillingPageSyncPanels = renderBillingPage;
    renderBillingPage = function renderBillingPageSyncPanels() {
        const result = previousRenderBillingPageSyncPanels();
        const caseData = state.currentCase;

        if (!caseData) {
            restoreUVRPanel();
            return result;
        }

        if (isDirectCase(caseData)) {
            showDirectPanel(caseData);
        } else {
            restoreUVRPanel();
        }

        return result;
    };

    // Deja los paneles en un estado coherente si la página ya está abierta.
    if (state.currentCase) {
        requestAnimationFrame(() => renderBillingPage());
    } else {
        restoreUVRPanel();
    }

    console.info('[SimuIPS] Paneles ISS sincronizados con el index nuevo.');
})();



/* ============================================================
   SIMUIPS — FUENTE SEPARADA PARA PRÁCTICA ISS NORMAL / AVANZADA
   Normal: data/cases.json
   Avanzada UVR: data/cases2.json
   ============================================================ */
(function installISSPracticeLevelDataSource() {
    'use strict';

    const ADVANCED_CASES_URL = './data/cases2.json';

    function getSelectedPracticeLevel() {
        let level = window.SIMUIPS_SELECTED_PRACTICE_LEVEL || '';
        try {
            level = sessionStorage.getItem('simuips_practice_level') || level;
        } catch (_) {}
        return String(level).toLowerCase() === 'advanced' ? 'advanced' : 'normal';
    }

    // Captura la selección antes de que otros listeners del HTML actúen.
    document.addEventListener('click', function rememberISSPracticeLevel(event) {
        const button = event.target.closest('[data-practice-level]');
        if (!button) return;

        const level = String(button.dataset.practiceLevel || '').toLowerCase() === 'advanced'
            ? 'advanced'
            : 'normal';

        window.SIMUIPS_SELECTED_PRACTICE_LEVEL = level;
        try {
            sessionStorage.setItem('simuips_practice_level', level);
        } catch (_) {}
    }, true);

    const previousStartPracticeCase = startPracticeCase;

    startPracticeCase = async function startPracticeCaseByISSLevel(mode = 'manual') {
        const level = getSelectedPracticeLevel();

        // La práctica normal conserva su fuente original.
        if (level !== 'advanced') {
            return previousStartPracticeCase('manual');
        }

        state.currentMode = 'manual';
        state.currentActivity = null;
        state.currentActivityCases = [];
        state.currentCaseIndex = 0;
        state.currentCase = null;
        state.currentLiquidation = null;
        state.currentValidation = null;
        state.selectedProcedure = null;
        state.selectedDiagnosis = null;

        let advancedCases = [];

        try {
            const response = await fetch(ADVANCED_CASES_URL, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`No se pudo cargar cases2.json (HTTP ${response.status})`);
            }

            const data = await response.json();

            if (Array.isArray(data)) {
                advancedCases = data;
            } else if (Array.isArray(data.cases)) {
                advancedCases = data.cases;
            } else if (Array.isArray(data.data)) {
                advancedCases = data.data;
            } else {
                throw new Error('La estructura de cases2.json no contiene un arreglo "cases".');
            }
        } catch (error) {
            console.error('[SimuIPS] Error cargando los casos avanzados desde data/cases2.json:', error);
            showBillingEmpty(true);
            toast(
                'No se pudo cargar la práctica avanzada. Verifica que data/cases2.json exista y tenga permiso de lectura.',
                'error'
            );
            return null;
        }

        // El archivo avanzado debe contener casos de práctica; no se mezclan
        // con cases.json ni se usa un fallback silencioso al catálogo normal.
        const usableCases = advancedCases.filter(item =>
            item && typeof item === 'object' && (item.id || item.procedure || item.issSolution)
        );

        if (!usableCases.length) {
            showBillingEmpty(true);
            toast('cases2.json no contiene casos avanzados utilizables.', 'warning');
            return null;
        }

        state.currentCase = clone(
            usableCases[Math.floor(Math.random() * usableCases.length)]
        );

        state.selectedProcedure = clone(state.currentCase.procedure || null);
        state.selectedDiagnosis = clone(state.currentCase.diagnosis || null);

        renderBillingPage();
        saveGuestSession();

        console.info(`[SimuIPS] Práctica ${level}: caso cargado desde ${ADVANCED_CASES_URL}.`);
        return state.currentCase;
    };

    console.info('[SimuIPS] Fuente de práctica por nivel instalada: normal=cases.json; avanzado=cases2.json.');
})();



/* ============================================================
   SIMUIPS — TEST ISS 2000 INTEGRADO EN SU PÁGINA
   - Solo funciona dentro de #page-test-iss.
   - 10 preguntas aleatorias por intento.
   - Evita repetir preguntas ya respondidas en intentos previos
     hasta agotar el banco disponible en el navegador.
   - No crea botones flotantes, modales ni páginas adicionales.
   ============================================================ */
(function installIntegratedISSTest() {
    'use strict';

    const DATA_URLS = ['./data/text.json', './text.json'];
    const HISTORY_KEY = 'simuips_iss_test_seen_v1';
    const BEST_KEY = 'simuips_iss_test_best_v1';
    const QUESTIONS_PER_TEST = 10;

    let bank = [];
    let attemptQuestions = [];
    let currentIndex = 0;
    let score = 0;
    let answered = false;
    let loadingPromise = null;
    let currentAnswers = [];

    const $id = id => document.getElementById(id);
    const shuffleQuestions = items => {
        const result = items.slice();
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    };

    function readJSON(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch {
            return fallback;
        }
    }

    function writeJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn('[SimuIPS Test ISS] No se pudo guardar el progreso:', error);
        }
    }

    function setText(id, value) {
        const node = $id(id);
        if (node) node.textContent = value ?? '';
    }

    function showPanel(id) {
        ['iss-test-start', 'iss-test-quiz', 'iss-test-results'].forEach(panelId => {
            const node = $id(panelId);
            if (node) node.hidden = panelId !== id;
        });
    }

    function setStatus(message, isError = false) {
        const loading = $id('iss-test-loading');
        const error = $id('iss-test-error');
        if (loading) {
            loading.hidden = true;
            loading.textContent = '';
        }
        if (error) {
            error.hidden = !isError;
            error.textContent = isError ? message : '';
        }
        if (!isError && message) {
            const status = $id('iss-test-loading');
            if (status) {
                status.hidden = false;
                status.textContent = message;
            }
        }
    }

    function normalizeQuestion(raw, index) {
        if (!raw || typeof raw.question !== 'string' || !raw.options || typeof raw.options !== 'object') return null;

        const optionKeys = Object.keys(raw.options);
        const correct = String(raw.correctAnswer ?? '').toLowerCase();
        const matchingKey = optionKeys.find(key => key.toLowerCase() === correct);
        if (!matchingKey || !optionKeys.length) return null;

        return {
            ...raw,
            id: String(raw.id ?? `iss-question-${index + 1}`),
            correctAnswer: matchingKey,
            options: raw.options,
            category: raw.category || 'Manual ISS 2000',
            explanation: raw.explanation || '',
            source: raw.source || {}
        };
    }

    async function loadQuestionBank() {
        if (bank.length) return bank;
        if (loadingPromise) return loadingPromise;

        loadingPromise = (async () => {
            let lastError = null;
            for (const url of DATA_URLS) {
                try {
                    const response = await fetch(url, { cache: 'no-store' });
                    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
                    const data = await response.json();
                    const questions = Array.isArray(data) ? data : data.questions;
                    if (!Array.isArray(questions)) throw new Error(`${url}: no se encontró la lista de preguntas.`);
                    const valid = questions.map(normalizeQuestion).filter(Boolean);
                    if (!valid.length) throw new Error(`${url}: no contiene preguntas con una estructura válida.`);
                    bank = valid;
                    return bank;
                } catch (error) {
                    lastError = error;
                }
            }
            throw lastError || new Error('No se encontró data/text.json.');
        })();

        try {
            return await loadingPromise;
        } finally {
            loadingPromise = null;
        }
    }

    function getSeenIds() {
        const ids = readJSON(HISTORY_KEY, []);
        return new Set(Array.isArray(ids) ? ids.map(String) : []);
    }

    function setSeenIds(ids) {
        writeJSON(HISTORY_KEY, [...ids]);
    }

    function updateStats() {
        setText('iss-test-bank-count', String(bank.length || '—'));
        const best = readJSON(BEST_KEY, null);
        setText('iss-test-best-score', best == null ? '—' : `${best}/10`);
    }

    function renderISSTestPage() {
        const page = $id('page-test-iss');
        if (!page) return;

        const begin = $id('iss-test-begin');
        const retry = $id('iss-test-retry');
        const back = $id('iss-test-back');

        if (begin && !begin.dataset.issBound) {
            begin.dataset.issBound = '1';
            begin.addEventListener('click', beginTest);
        }
        if (retry && !retry.dataset.issBound) {
            retry.dataset.issBound = '1';
            retry.addEventListener('click', beginTest);
        }

        // El símbolo de reinicio de resultados también debe ser funcional.
        const resultSymbol = $id('iss-test-result-symbol');
        if (resultSymbol && !resultSymbol.dataset.issBound) {
            resultSymbol.dataset.issBound = '1';
            resultSymbol.setAttribute('role', 'button');
            resultSymbol.setAttribute('tabindex', '0');
            resultSymbol.setAttribute('aria-label', 'Repetir test');
            resultSymbol.style.cursor = 'pointer';
            resultSymbol.addEventListener('click', beginTest);
            resultSymbol.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    beginTest();
                }
            });
        }
        if (back && !back.dataset.issBound) {
            back.dataset.issBound = '1';
            back.addEventListener('click', () => {
                if (typeof navigate === 'function') navigate('dashboard');
            });
        }

        showPanel('iss-test-start');
        setText('iss-test-bank-count', bank.length ? String(bank.length) : '—');
        setStatus('Cargando banco de preguntas…');

        loadQuestionBank().then(() => {
            setStatus('');
            updateStats();
            showPanel('iss-test-start');
        }).catch(error => {
            setStatus(
                `No se pudo cargar el banco de preguntas. ${error.message || ''} Verifica que el archivo esté en data/text.json junto al proyecto.`,
                true
            );
        });
    }

    function beginTest() {
        const beginButton = $id('iss-test-begin');
        if (beginButton) beginButton.disabled = true;
        setStatus('Preparando 10 preguntas aleatorias…');

        loadQuestionBank().then(() => {
            const seen = getSeenIds();
            let unseen = bank.filter(question => !seen.has(String(question.id)));

            // Mantiene siempre 10 preguntas. Cuando quedan menos de 10 sin usar,
            // comienza un nuevo ciclo para no iniciar un test incompleto.
            if (unseen.length < QUESTIONS_PER_TEST) {
                unseen = bank.slice();
                setSeenIds([]);
            }

            if (unseen.length < QUESTIONS_PER_TEST) {
                throw new Error(`El banco necesita al menos ${QUESTIONS_PER_TEST} preguntas válidas.`);
            }

            attemptQuestions = shuffleQuestions(unseen).slice(0, QUESTIONS_PER_TEST);
            currentAnswers = [];
            currentIndex = 0;
            score = 0;
            answered = false;

            // Marcar como usadas al iniciar evita que cerrar la página permita
            // volver a recibir las mismas preguntas en el siguiente intento.
            const updatedSeen = getSeenIds();
            attemptQuestions.forEach(question => updatedSeen.add(String(question.id)));
            setSeenIds(updatedSeen);

            if (beginButton) beginButton.disabled = false;
            setStatus('');
            renderQuestion();
        }).catch(error => {
            if (beginButton) beginButton.disabled = false;
            setStatus(error.message || 'No fue posible iniciar el test.', true);
        });
    }

    function renderQuestion() {
        const quiz = $id('iss-test-quiz');
        const optionsContainer = $id('iss-test-options');
        if (!quiz || !optionsContainer) return;

        if (currentIndex >= attemptQuestions.length) {
            renderResults();
            return;
        }

        answered = false;
        const question = attemptQuestions[currentIndex];
        const percent = Math.round((currentIndex / QUESTIONS_PER_TEST) * 100);
        setText('iss-test-question-count', `Pregunta ${currentIndex + 1} de ${QUESTIONS_PER_TEST}`);
        setText('iss-test-progress-label', `${percent}% completado`);
        setText('iss-test-topic', question.category);
        setText('iss-test-question', question.question);
        setText('iss-test-answer-hint', 'Selecciona una respuesta para continuar.');
        setText('iss-test-progress-bar', '');
        const progressBar = $id('iss-test-progress-bar');
        if (progressBar) progressBar.style.width = `${percent}%`;

        optionsContainer.replaceChildren();

        // La retroalimentación se crea dentro del test para no exigir cambios en HTML.
        let feedback = $id('iss-test-live-feedback');
        if (!feedback) {
            feedback = document.createElement('section');
            feedback.id = 'iss-test-live-feedback';
            feedback.className = 'iss-test-review-item iss-test-feedback';
            feedback.setAttribute('aria-live', 'polite');
            feedback.style.display = 'none';
            feedback.style.marginTop = '16px';
            feedback.style.padding = '16px';
            feedback.style.borderRadius = '12px';
            feedback.style.lineHeight = '1.65';
            optionsContainer.insertAdjacentElement('afterend', feedback);
        }
        feedback.replaceChildren();
        feedback.style.display = 'none';

        Object.entries(question.options).forEach(([key, optionText]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'iss-test-option';
            button.dataset.answer = key;
            const letter = document.createElement('span');
            letter.className = 'iss-test-option-letter';
            letter.textContent = key.toUpperCase();
            const text = document.createElement('span');
            text.className = 'iss-test-option-text';
            text.textContent = String(optionText);
            button.append(letter, text);
            button.addEventListener('click', () => answerQuestion(key));
            optionsContainer.appendChild(button);
        });

        const next = $id('iss-test-next');
        if (next) {
            next.disabled = true;
            next.onclick = () => {
                if (!answered) return;
                currentIndex++;
                renderQuestion();
            };
        }

        showPanel('iss-test-quiz');
        const error = $id('iss-test-error');
        if (error) error.hidden = true;
        const loading = $id('iss-test-loading');
        if (loading) loading.hidden = true;
    }

    function answerQuestion(key) {
        if (answered || !attemptQuestions[currentIndex]) return;
        answered = true;

        const question = attemptQuestions[currentIndex];
        const correct = String(key).toLowerCase() === String(question.correctAnswer).toLowerCase();
        if (correct) score++;
        currentAnswers[currentIndex] = {
            question,
            selected: key,
            correct
        };

        const optionsContainer = $id('iss-test-options');
        optionsContainer?.querySelectorAll('[data-answer]').forEach(button => {
            button.disabled = true;
            const answer = button.dataset.answer;
            if (String(answer).toLowerCase() === String(question.correctAnswer).toLowerCase()) {
                button.classList.add('is-selected');
                button.style.borderColor = '#35d6a7';
                button.style.background = 'rgba(53,214,167,.12)';
            } else if (String(answer) === String(key)) {
                button.style.borderColor = '#e87979';
                button.style.background = 'rgba(232,121,121,.10)';
            }
        });

        setText(
            'iss-test-answer-hint',
            correct ? '¡Correcto! Revisa la explicación y continúa cuando estés listo.' : 'Respuesta incorrecta. Revisa cuál era la opción correcta y por qué.'
        );

        // Explicación inmediata tras seleccionar la respuesta.
        const feedback = $id('iss-test-live-feedback');
        if (feedback) {
            feedback.replaceChildren();
            feedback.style.display = 'block';
            feedback.style.border = correct
                ? '1px solid rgba(53,214,167,.42)'
                : '1px solid rgba(232,121,121,.45)';
            feedback.style.background = correct
                ? 'rgba(53,214,167,.08)'
                : 'rgba(232,121,121,.08)';

            const title = document.createElement('strong');
            title.textContent = correct ? '✓ ¡Respuesta correcta!' : '✕ Respuesta incorrecta';
            title.style.display = 'block';
            title.style.marginBottom = '8px';
            title.style.color = correct ? '#35d6a7' : '#f08a8a';

            const correctAnswer = document.createElement('p');
            correctAnswer.style.margin = '0 0 8px';
            correctAnswer.textContent = `Respuesta correcta: ${String(question.correctAnswer).toUpperCase()}. ${question.options[question.correctAnswer] ?? ''}`;

            const explanation = document.createElement('p');
            explanation.style.margin = '0 0 8px';
            explanation.textContent = question.explanation || 'El banco de preguntas no incluye una explicación para este ítem.';

            const source = document.createElement('p');
            source.style.margin = '0';
            source.style.fontSize = '12px';
            source.style.opacity = '.8';
            const sourceParts = [question.source?.document, question.source?.article, question.source?.chapter].filter(Boolean);
            source.textContent = sourceParts.length ? `Fuente: ${sourceParts.join(' · ')}` : 'Fuente: Manual ISS 2000 (verifica la edición y el contrato aplicable).';

            feedback.append(title, correctAnswer, explanation, source);
        }

        const next = $id('iss-test-next');
        if (next) {
            next.disabled = false;
            next.innerHTML = currentIndex === QUESTIONS_PER_TEST - 1
                ? 'Ver resultados →'
                : 'Siguiente →';
        }
    }

    function renderResults() {
        const correctCount = currentAnswers.filter(answer => answer?.correct).length;
        const percent = Math.round((correctCount / QUESTIONS_PER_TEST) * 100);
        const previousBest = Number(readJSON(BEST_KEY, 0)) || 0;
        const best = Math.max(previousBest, correctCount);
        writeJSON(BEST_KEY, best);
        updateStats();

        setText('iss-test-score-number', `${correctCount}/${QUESTIONS_PER_TEST}`);
        setText('iss-test-score-percent', `${percent}%`);
        setText('iss-test-result-title', percent >= 90 ? '¡Excelente trabajo!' : percent >= 70 ? '¡Buen avance!' : 'Sigue practicando');
        setText(
            'iss-test-result-message',
            percent >= 90
                ? 'Excelente resultado. Mantén la práctica para consolidar tus conocimientos del Manual ISS 2000.'
                : percent >= 70
                    ? 'Vas por buen camino. Refuerza los temas relacionados con las preguntas que fallaste y vuelve a practicar.'
                    : 'Te recomendamos repasar los conceptos fundamentales del Manual ISS 2000 y realizar otro intento para medir tu progreso.'
        );

        const scoreBar = $id('iss-test-score-bar');
        if (scoreBar) scoreBar.style.width = `${percent}%`;

        // No repetir al final las explicaciones ya mostradas después de cada respuesta.
        // Se conserva la tarjeta de diagnóstico y los botones para repetir o volver al inicio.
        const review = $id('iss-test-review');
        if (review) {
            review.replaceChildren();
            review.hidden = true;
            review.style.display = 'none';
            review.setAttribute('aria-hidden', 'true');
        }

        const bar = $id('iss-test-progress-bar');
        if (bar) bar.style.width = '100%';
        showPanel('iss-test-results');
    }

    // Exponer solo el punto de entrada usado por el enrutador principal.
    // No se agrega ningún botón flotante ni modal global.
    window.SimuIPSISS = Object.freeze({
        renderPage: renderISSTestPage
    });
    console.info('[SimuIPS] Test ISS integrado en #page-test-iss.');
})();


/* ============================================================
   SIMUIPS — SINCRONIZACIÓN FIRESTORE
   Clases, casos y actividades docentes se sincronizan en la nube.
   Los invitados consultan actividades habilitadas para invitados;
   su sesión y progreso continúan siendo temporales en sessionStorage.
   ============================================================ */

async function cloudSaveRecord(collectionName, record) {
    if (!firebaseDb || !record?.id) throw new Error('Firebase no está inicializado o falta el ID del registro.');
    const ref = firebaseDoc(firebaseDb, collectionName, String(record.id));
    await firebaseSetDoc(ref, {
        ...record,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

async function cloudLoadCollection(collectionName, constraints = []) {
    if (!firebaseDb) await initializeFirebase();
    const source = firebaseCollection(firebaseDb, collectionName);
    const q = constraints.length
        ? firebaseQuery(source, ...constraints)
        : source;
    const snapshot = await firebaseGetDocs(q);
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

async function cloudLoadWorkspace(user) {
    if (!user?.id || isGuest()) return;
    try {
        const [classes, cases, activities] = await Promise.all([
            cloudLoadCollection('classes', [
                firebaseWhere('teacherId', '==', user.id)
            ]),
            cloudLoadCollection('cases', [
                firebaseWhere('teacherId', '==', user.id)
            ]),
            cloudLoadCollection('activities', [
                firebaseWhere('teacherId', '==', user.id)
            ])
        ]);
        // Para docentes, sus propios registros de nube reemplazan los datos locales.
        if (user.role === 'teacher') {
            state.classes = classes;
            state.cases = cases;
            state.activities = activities;
            writeStorage(APP.storage.classes, classes);
            writeStorage(APP.storage.cases, cases);
            writeStorage(APP.storage.activities, activities);
        }
        // Estudiantes consultan actividades asignadas a clases en las que están inscritos.
        if (user.role === 'student') {
            const enrollments = await cloudLoadCollection('enrollments', [
                firebaseWhere('studentId', '==', user.id)
            ]);
            state.enrollments = enrollments;
            const classIds = new Set(enrollments.filter(x => x.type === 'class').map(x => x.classId));
            const sharedActivities = await cloudLoadCollection('activities');
            state.activities = sharedActivities.filter(a => classIds.has(a.classId));
            const neededCaseIds = new Set(state.activities.flatMap(a => a.caseIds || []));
            const allCases = await cloudLoadCollection('cases');
            state.cases = allCases.filter(c => neededCaseIds.has(c.id));
        }
    } catch (error) {
        console.error('[SimuIPS] No se pudieron sincronizar clases/casos/actividades:', error);
        toast('No se pudieron sincronizar las clases o actividades. Revisa las reglas de Firestore.', 'error');
    }
}

async function cloudPersistOwnedRecords() {
    if (!state.user || isGuest() || state.user.role !== 'teacher') return;
    await initializeFirebase();
    const own = record => record.teacherId === state.user.id;
    const batches = [
        ...state.classes.filter(own).map(record => cloudSaveRecord('classes', record)),
        ...state.cases.filter(own).map(record => cloudSaveRecord('cases', record)),
        ...state.activities.filter(own).map(record => cloudSaveRecord('activities', record))
    ];
    await Promise.all(batches);
}


/* ============================================================
   SIMUIPS SOLO INVITADOS — LIMPIEZA DE NAVEGACIÓN
   Oculta controles de configuración, autenticación y actividades
   que no forman parte de la experiencia de invitado.
============================================================ */
(function guestOnlyNavigationCleanup() {
    'use strict';
    const removeGuestExcludedItems = () => {
        document.querySelectorAll(
            '.sidebar-bottom [data-page="settings"], #sidebar-login-button, #logout-button, #sidebar-nav [data-page="join-activity"], #sidebar-nav [data-page="activity"], .sidebar-bottom [data-page="join-activity"]'
        ).forEach(element => element.remove());

        document.querySelectorAll('#sidebar-nav button, #sidebar-nav a, .sidebar-bottom button').forEach(element => {
            const label = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');
            if (label === 'unirme a actividad' || label === 'configuración' || label === 'iniciar sesión' || label === 'cerrar sesión') {
                element.remove();
            }
        });
    };
    removeGuestExcludedItems();
    const nav = document.getElementById('sidebar-nav');
    if (nav && window.MutationObserver) {
        new MutationObserver(removeGuestExcludedItems).observe(nav, { childList: true, subtree: true });
    }
    document.addEventListener('DOMContentLoaded', removeGuestExcludedItems);
    setTimeout(removeGuestExcludedItems, 0);
})();

/* ============================================================
   SIMUIPS HOTFIX FINAL — CARGA REAL DE CASOS + LIMPIEZA INVITADO
   - Carga directamente los JSON para evitar módulos vacíos/cacheados.
   - cases.json = práctica normal; cases2.json = práctica avanzada.
   - Al elegir práctica desde su página, abre la liquidación al cargar.
   - Retira la tarjeta "Unirse a actividad" del dashboard invitado.
============================================================ */
(function installFinalCasesAndGuestCleanup() {
    'use strict';

    const CASES_NORMAL_URL = './data/cases.json';
    const CASES_ADVANCED_URL = './data/cases2.json';

    function extractCases(payload) {
        if (Array.isArray(payload)) return payload;
        if (!payload || typeof payload !== 'object') return [];

        for (const key of ['cases', 'casos', 'data', 'items', 'records', 'results']) {
            if (Array.isArray(payload[key])) return payload[key];
        }
        return [];
    }

    function selectedLevel() {
        let level = window.SIMUIPS_SELECTED_PRACTICE_LEVEL || '';
        try {
            level = sessionStorage.getItem('simuips_practice_level') || level;
        } catch (_) {}
        return String(level).toLowerCase() === 'advanced' ? 'advanced' : 'normal';
    }

    async function fetchCases(url) {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
        const payload = await response.json();
        const cases = extractCases(payload);
        if (!cases.length) throw new Error(`${url}: no contiene una lista de casos reconocible`);
        return cases.filter(item => item && typeof item === 'object');
    }

    const previousStartPracticeCaseFinal = startPracticeCase;

    startPracticeCase = async function startPracticeCaseFinal(mode = 'manual') {
        const pageBeforeLoad = state.page;
        const isActivityFlow = Boolean(state.currentActivity);

        state.currentMode = 'manual';
        state.currentLiquidation = null;
        state.currentValidation = null;
        state.selectedProcedure = null;
        state.selectedDiagnosis = null;

        let cases = [];
        const level = selectedLevel();

        try {
            cases = await fetchCases(
                level === 'advanced' ? CASES_ADVANCED_URL : CASES_NORMAL_URL
            );
        } catch (primaryError) {
            console.error('[SimuIPS] Error cargando el JSON de casos:', primaryError);

            // Si la fuente avanzada falla, no sustituirla silenciosamente por casos normales.
            if (level === 'advanced') {
                showBillingEmpty(true);
                toast('No se pudieron abrir los casos avanzados. Revisa data/cases2.json.', 'error');
                return null;
            }

            // Solo para casos normales, permite usar casos creados localmente.
            cases = Array.isArray(state.cases) ? state.cases : [];
            if (!cases.length) {
                try {
                    cases = await previousStartPracticeCaseFinal('manual');
                    if (state.currentCase) cases = [state.currentCase];
                } catch (error) {
                    console.error('[SimuIPS] También falló el respaldo de casos locales:', error);
                }
            }
        }

        const usableCases = cases.filter(item =>
            item &&
            typeof item === 'object' &&
            (item.id || item.procedure || item.issSolution || item.patient || item.concepts)
        );

        if (!usableCases.length) {
            state.currentCase = null;
            showBillingEmpty(true);
            toast('El archivo de casos se cargó, pero no contiene casos utilizables.', 'warning');
            return null;
        }

        state.currentActivity = isActivityFlow ? state.currentActivity : null;
        state.currentCaseIndex = 0;
        state.currentCase = clone(usableCases[Math.floor(Math.random() * usableCases.length)]);
        state.selectedProcedure = clone(state.currentCase.procedure || null);
        state.selectedDiagnosis = clone(state.currentCase.diagnosis || null);
        state.currentLiquidation = null;
        state.currentValidation = null;

        showBillingEmpty(false);
        renderBillingPage();
        if (typeof saveGuestSession === 'function') saveGuestSession();

        console.info(`[SimuIPS] Caso cargado: ${level === 'advanced' ? 'cases2.json' : 'cases.json'} (${usableCases.length} disponibles).`);

        // La pantalla de práctica no es la pantalla de liquidación:
        // una vez cargado el caso, cambiar a Liquidación.
        if (!isActivityFlow && ['manual-mode', 'automatic-mode'].includes(pageBeforeLoad)) {
            state.page = 'billing';
            renderApplication();
        }

        return state.currentCase;
    };

    function removeGuestActivityCard() {
        if (typeof isGuest !== 'function' || !isGuest()) return;

        const dashboard = document.getElementById('guest-dashboard-content');
        if (dashboard) {
            const candidates = dashboard.querySelectorAll('h1,h2,h3,h4,p,span,button,a,[role="button"]');
            for (const node of candidates) {
                const label = (node.textContent || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');
                if (label === 'unirse a actividad') {
                    const card = node.closest('.activity-card, .dashboard-card, .feature-card, .action-card, .card, article');
                    if (card && card !== dashboard) {
                        card.remove();
                    } else {
                        const parent = node.parentElement;
                        if (parent && parent !== dashboard) parent.remove();
                    }
                    break;
                }
            }
        }

        document.querySelectorAll(
            '.sidebar-bottom [data-page="settings"], #sidebar-login-button, #logout-button, ' +
            '#sidebar-nav [data-page="join-activity"], .sidebar-bottom [data-page="join-activity"]'
        ).forEach(element => element.remove());

        document.querySelectorAll('#sidebar-nav button, #sidebar-nav a, .sidebar-bottom button').forEach(element => {
            const label = (element.innerText || element.textContent || '')
                .replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');
            if (['unirme a actividad', 'configuración', 'iniciar sesión', 'cerrar sesión'].includes(label)) {
                element.remove();
            }
        });
    }

    const previousRenderDashboardFinal = renderDashboard;
    renderDashboard = function renderDashboardFinal() {
        const result = previousRenderDashboardFinal();
        removeGuestActivityCard();
        return result;
    };

    const previousRenderApplicationFinal = renderApplication;
    renderApplication = function renderApplicationFinal() {
        const result = previousRenderApplicationFinal();
        removeGuestActivityCard();
        return result;
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', removeGuestActivityCard, { once: true });
    } else {
        removeGuestActivityCard();
    }

    console.info('[SimuIPS] Hotfix final de carga de cases.json/cases2.json instalado.');
})();



/* ============================================================
   SIMUIPS — FLUJO DE INVITADO Y SELECTOR NORMAL / AVANZADO
   - Entrar como invitado muestra el selector, no Liquidación.
   - Los botones de nivel cargan el JSON correspondiente.
   - Impide que un data-page accidental salte el selector.
   ============================================================ */
(function fixGuestPracticeLevelFlow() {
    'use strict';

    // Capa de carga ligera: mejora la transición mientras se obtiene el JSON
    // y se prepara la pantalla de liquidación. No bloquea el motor ni altera datos.
    const PRACTICE_LOADING_STYLE_ID = 'simuips-practice-loading-styles';
    if (!document.getElementById(PRACTICE_LOADING_STYLE_ID)) {
        const style = document.createElement('style');
        style.id = PRACTICE_LOADING_STYLE_ID;
        style.textContent = `
            #simuips-practice-loading {
                position: fixed; inset: 0; z-index: 99999;
                display: grid; place-items: center; padding: 24px;
                background: rgba(5, 10, 15, .78);
                -webkit-backdrop-filter: blur(9px); backdrop-filter: blur(9px);
                opacity: 0; visibility: hidden;
                transition: opacity .22s ease, visibility .22s ease;
            }
            #simuips-practice-loading.is-visible { opacity: 1; visibility: visible; }
            #simuips-practice-loading .spl-card {
                width: min(100%, 360px); padding: 30px 26px 25px;
                text-align: center; border-radius: 22px;
                border: 1px solid rgba(52, 211, 153, .25);
                background: linear-gradient(145deg, rgba(17, 29, 37, .98), rgba(7, 13, 19, .98));
                box-shadow: 0 24px 90px rgba(0,0,0,.42), 0 0 45px rgba(16,185,129,.08);
                transform: translateY(10px) scale(.985);
                transition: transform .28s cubic-bezier(.2,.8,.2,1);
            }
            #simuips-practice-loading.is-visible .spl-card { transform: translateY(0) scale(1); }
            #simuips-practice-loading .spl-mark {
                width: 58px; height: 58px; margin: 0 auto 19px; position: relative;
                display: grid; place-items: center; border-radius: 18px;
                background: rgba(16,185,129,.12); border: 1px solid rgba(52,211,153,.25);
            }
            #simuips-practice-loading .spl-ring {
                position: absolute; inset: -5px; border: 2px solid transparent;
                border-top-color: #34d399; border-right-color: rgba(52,211,153,.35);
                border-radius: 22px; animation: spl-spin .9s linear infinite;
            }
            #simuips-practice-loading .spl-plus { color: #34d399; font-size: 28px; font-weight: 800; line-height: 1; }
            #simuips-practice-loading .spl-title { margin: 0; color: #f8fafc; font-size: 19px; font-weight: 800; letter-spacing: -.025em; }
            #simuips-practice-loading .spl-copy { margin: 9px 0 19px; color: #94a3b8; font-size: 13px; line-height: 1.55; }
            #simuips-practice-loading .spl-track { height: 4px; overflow: hidden; border-radius: 99px; background: rgba(148,163,184,.14); }
            #simuips-practice-loading .spl-progress {
                width: 42%; height: 100%; border-radius: inherit;
                background: linear-gradient(90deg, #10b981, #6ee7b7);
                animation: spl-progress 1.35s ease-in-out infinite;
            }
            #simuips-practice-loading .spl-foot { margin-top: 12px; color: #64748b; font-size: 10px; letter-spacing: .13em; font-weight: 800; text-transform: uppercase; }
            @keyframes spl-spin { to { transform: rotate(360deg); } }
            @keyframes spl-progress { 0% { transform: translateX(-110%); } 100% { transform: translateX(260%); } }
            @media (prefers-reduced-motion: reduce) {
                #simuips-practice-loading, #simuips-practice-loading .spl-card { transition: none; }
                #simuips-practice-loading .spl-ring, #simuips-practice-loading .spl-progress { animation-duration: 3s; }
            }
        `;
        document.head.appendChild(style);
    }

    let practiceLoadingTimer = null;
    function showPracticeLoading(level) {
        let overlay = document.getElementById('simuips-practice-loading');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'simuips-practice-loading';
            overlay.setAttribute('role', 'status');
            overlay.setAttribute('aria-live', 'polite');
            overlay.innerHTML = `
                <div class="spl-card">
                    <div class="spl-mark" aria-hidden="true"><span class="spl-ring"></span><span class="spl-plus">+</span></div>
                    <h2 class="spl-title">Preparando tu práctica</h2>
                    <p class="spl-copy" data-loading-copy>Estamos cargando los casos y organizando el ejercicio.</p>
                    <div class="spl-track" aria-hidden="true"><div class="spl-progress"></div></div>
                    <div class="spl-foot">SimuIPS · Entrenamiento</div>
                </div>`;
            document.body.appendChild(overlay);
        }

        const copy = overlay.querySelector('[data-loading-copy]');
        const messages = level === 'advanced'
            ? ['Cargando los casos avanzados…', 'Preparando los datos UVR…', 'Organizando tu reto…']
            : ['Cargando los casos de práctica…', 'Preparando el ejercicio…', 'Organizando tu sesión…'];
        let messageIndex = 0;
        if (copy) copy.textContent = messages[0];
        clearInterval(practiceLoadingTimer);
        practiceLoadingTimer = setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            if (copy && overlay.isConnected) copy.textContent = messages[messageIndex];
        }, 1500);

        // Deja que el navegador pinte la animación antes de iniciar el fetch.
        requestAnimationFrame(() => overlay.classList.add('is-visible'));
        return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    function hidePracticeLoading() {
        clearInterval(practiceLoadingTimer);
        practiceLoadingTimer = null;
        const overlay = document.getElementById('simuips-practice-loading');
        if (!overlay) return;
        overlay.classList.remove('is-visible');
        setTimeout(() => {
            if (overlay.isConnected && !overlay.classList.contains('is-visible')) overlay.remove();
        }, 260);
    }

    function saveSelectedLevel(level) {
        const normalized = String(level || '').toLowerCase();
        const selected = normalized === 'advanced' || normalized === 'avanzado'
            ? 'advanced'
            : 'normal';

        window.SIMUIPS_SELECTED_PRACTICE_LEVEL = selected;
        try {
            sessionStorage.setItem('simuips_practice_level', selected);
        } catch (_) {}

        return selected;
    }

    /*
     * La pantalla manual-mode es el selector de modalidad.
     * No debe iniciar casos automáticamente al renderizarse.
     */
    renderPracticeMode = function renderPracticeLevelSelector() {
        state.currentMode = 'manual';

        // Al volver al selector, no reutilizar un caso anterior.
        if (state.page === 'manual-mode' && !state.currentActivity) {
            state.currentCase = null;
            state.currentLiquidation = null;
            state.currentValidation = null;
            state.selectedProcedure = null;
            state.selectedDiagnosis = null;
        }
    };

    /*
     * Captura el clic antes que la navegación global. Funciona tanto
     * con data-practice-level como con botones que solo tienen texto.
     */
    document.addEventListener('click', async function handlePracticeLevelButton(event) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const button = target.closest(
            'button, [role="button"], [data-practice-level], [data-level], .practice-level-card, .practice-option, .practice-card'
        );
        if (!button) return;

        const label = (button.innerText || button.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLocaleLowerCase('es');

        const rawLevel = button.dataset.practiceLevel || button.dataset.level || '';
        const isAdvanced = /advanced|avanzad|reto/.test(String(rawLevel).toLowerCase()) ||
            /avanzad|reto/.test(label);
        const isNormal = /normal|básic|basico|inicial/.test(String(rawLevel).toLowerCase()) ||
            /nivel normal|práctica normal|practica normal|comenzar nivel normal/.test(label);

        if (!isAdvanced && !isNormal) return;

        // Evita que data-page/data-nav-page envíe al usuario a otra pantalla.
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
        }

        if (button.dataset.loading === 'true') return;
        button.dataset.loading = 'true';
        button.setAttribute('aria-busy', 'true');

        const level = saveSelectedLevel(isAdvanced ? 'advanced' : 'normal');
        await showPracticeLoading(level);

        state.currentMode = 'manual';
        state.currentActivity = null;
        state.currentActivityCases = [];
        state.currentCaseIndex = 0;
        state.currentCase = null;
        state.currentLiquidation = null;
        state.currentValidation = null;
        state.selectedProcedure = null;
        state.selectedDiagnosis = null;

        try {
            const loadedCase = await startPracticeCase('manual');

            if (!loadedCase && !state.currentCase) {
                // startPracticeCase muestra el aviso específico si falla cases2.json.
                state.page = 'manual-mode';
                renderApplication();
                return;
            }

            // La carga final de casos también navega a billing cuando procede.
            if (state.page !== 'billing') {
                navigate('billing');
            }

            saveGuestSession();
        } catch (error) {
            console.error('[SimuIPS] No se pudo iniciar el nivel seleccionado:', error);
            toast(
                level === 'advanced'
                    ? 'No se pudo iniciar el reto avanzado. Revisa data/cases2.json.'
                    : 'No se pudo iniciar la práctica normal. Revisa data/cases.json.',
                'error'
            );
        } finally {
            hidePracticeLoading();
            button.dataset.loading = 'false';
            button.removeAttribute('aria-busy');
        }
    }, true);

    console.info('[SimuIPS] Flujo corregido: selector primero y carga de caso al elegir nivel.');
})();



/* ============================================================
   SIMUIPS — MODO ESTUDIANTE ISS
   Presentación de caso + soportes + liquidación existente.
   CSS incluido aquí para no depender de un archivo adicional.
   ============================================================ */
(function installISSStudentModeUI() {
    'use strict';

    const STYLE_ID = 'simuips-iss-student-mode-styles';

    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          .simuips-student-case { margin: 0 0 22px; color: var(--text-primary, #e5e7eb); }
          .simuips-student-case * { box-sizing: border-box; }
          .simuips-case-hero { border: 1px solid var(--border-color, rgba(148,163,184,.22)); border-radius: 16px; padding: 22px; background: var(--card-bg, rgba(15,23,42,.42)); margin-bottom: 14px; }
          .simuips-case-kicker { display:flex; align-items:center; gap:8px; color:#4adeb0; font-size:11px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; margin-bottom:10px; }
          .simuips-case-procedure { margin: -8px 0 12px; color:var(--text-secondary,#94a3b8); font-size:14px; font-weight:650; line-height:1.5; }
          .simuips-case-title { margin:0 0 10px; font-size:clamp(20px,2.5vw,27px); line-height:1.25; font-weight:750; }
          .simuips-case-narrative { margin:0; line-height:1.75; color:var(--text-secondary,#cbd5e1); font-size:14px; white-space:pre-line; }
          .simuips-task { margin-top:16px; padding:14px 16px; border-radius:12px; background:rgba(16,185,129,.08); border:1px solid rgba(45,212,170,.24); }
          .simuips-task strong { display:block; margin-bottom:6px; font-size:13px; }
          .simuips-task p { margin:0; font-size:13px; line-height:1.65; color:var(--text-secondary,#cbd5e1); }
          .simuips-docs-card { border:1px solid var(--border-color,rgba(148,163,184,.22)); border-radius:16px; overflow:hidden; margin-bottom:22px; background:var(--card-bg,rgba(15,23,42,.32)); }
          .simuips-docs-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:17px 20px; border-bottom:1px solid var(--border-color,rgba(148,163,184,.18)); }
          .simuips-docs-head h3 { margin:0; font-size:16px; font-weight:750; }
          .simuips-docs-head p { margin:4px 0 0; font-size:12px; color:var(--text-secondary,#94a3b8); }
          .simuips-docs-list { padding:8px 14px; }
          .simuips-doc { border-bottom:1px solid var(--border-color,rgba(148,163,184,.12)); }
          .simuips-doc:last-child { border-bottom:0; }
          .simuips-doc summary { cursor:pointer; list-style:none; display:flex; align-items:center; gap:12px; padding:14px 6px; }
          .simuips-doc summary::-webkit-details-marker { display:none; }
          .simuips-doc-icon { flex:0 0 38px; width:38px; height:38px; border-radius:10px; display:grid; place-items:center; background:rgba(148,163,184,.12); font-size:17px; }
          .simuips-doc-title { flex:1; min-width:0; font-weight:650; font-size:13px; }
          .simuips-doc-status { display:inline-flex; align-items:center; border-radius:999px; padding:4px 8px; font-size:10px; font-weight:750; background:rgba(34,197,94,.10); color:#4ade80; white-space:nowrap; }
          .simuips-doc-status.review { background:rgba(245,158,11,.12); color:#fbbf24; }
          .simuips-doc-status.missing { background:rgba(239,68,68,.10); color:#f87171; }
          .simuips-doc-body { padding:0 8px 16px 56px; font-size:13px; line-height:1.7; color:var(--text-secondary,#cbd5e1); white-space:pre-line; }
          .simuips-doc-body p { margin:0 0 8px; }
          .simuips-doc-purpose { margin-top:8px; font-size:12px; color:var(--text-secondary,#94a3b8); }
          .simuips-doc-chevron { color:var(--text-secondary,#94a3b8); transition:transform .18s ease; }
          .simuips-doc[open] .simuips-doc-chevron { transform:rotate(90deg); }
          @media(max-width:640px) {
            .simuips-case-hero { padding:17px; }
            .simuips-docs-head { padding:15px; }
            .simuips-docs-list { padding:6px 10px; }
            .simuips-doc-status { display:none; }
            .simuips-doc-body { padding-left:8px; }
          }
        `;
        document.head.appendChild(style);
    }

    const safe = value => (typeof escapeHTML === 'function'
        ? escapeHTML(value == null ? '' : String(value))
        : String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
        }[ch])));

    function getStudentData(caseData) {
        return caseData?.studentMode ||
            caseData?.studentExperience ||
            caseData?.issStudentMode ||
            null;
    }

    function findAnchor() {
        return document.querySelector(
            '#manual-concepts, #manual-iss-concepts, #billing-concepts, ' +
            '#uvr-liquidation-panel, #direct-tariff-panel, .billing-liquidation-card, ' +
            '#billing-procedure-search'
        );
    }

    function renderStudentCase(caseData) {
        const data = getStudentData(caseData);
        const existing = document.getElementById('simuips-student-case-panel');
        if (!data || data.enabled === false) {
            existing?.remove();
            return;
        }

        const anchor = findAnchor();
        if (!anchor) return;

        const narrative = data.caseNarrative || data.narrative ||
            caseData.description || caseData.trainingNote || '';
        const patientName = data.patientName || caseData.patient?.name ||
            caseData.patient?.nombre || 'Caso asignado';
        const procedureName = caseData.procedure?.description ||
            caseData.issSolution?.description || caseData.name || 'Procedimiento del caso';
        const instructions = data.taskInstructions || data.instructions ||
            `Realiza la liquidación de ${procedureName} y registra los conceptos y valores que correspondan.`;
        // El JSON actualizado guarda whatIsProcedure tanto en la raíz del caso
        // como dentro de studentMode. Se admiten ambas ubicaciones para que el
        // botón funcione incluso si se publica una versión del JSON con una sola.
        const whatIs = caseData.whatIsProcedure ||
            data.whatIsProcedure ||
            caseData.studentExperience?.whatIsProcedure ||
            caseData.issStudentMode?.whatIsProcedure ||
            {};
        const whatIsTitle = whatIs.title || procedureName;
        const whatIsSummary = whatIs.summary ||
            whatIs.description ||
            'La explicación educativa de este procedimiento no está configurada en el JSON.';
        const whatIsPurpose = whatIs.purpose ||
            `Se realiza para ayudar a resolver la estrechez de la uretra y facilitar el paso de la orina, según la valoración médica.`;
        // No mostrar la nota genérica del JSON: no aporta información específica
        // y hace que la guía parezca una advertencia de auditoría.
        const whatIsNote = typeof whatIs.note === 'string' &&
            whatIs.note.trim() &&
            !/descripci[oó]n educativa general del procedimiento/i.test(whatIs.note)
            ? whatIs.note.trim()
            : '';

        // En esta pantalla no se inserta el bloque de documentos/soportes
        // que estaba mostrando tarjetas fuera de contexto para el ejercicio.
        const panel = document.createElement('section');
        panel.id = 'simuips-student-case-panel';
        panel.className = 'simuips-student-case';
        panel.innerHTML = `
          <div class="simuips-case-hero">
            <div class="simuips-case-kicker"><span aria-hidden="true">▣</span> Caso práctico · Modo estudiante</div>
            <h2 class="simuips-case-title">${safe(patientName)}</h2>
            <div class="simuips-what-is-actions">
              <button type="button" class="simuips-what-is-btn" data-simuips-what-is-open aria-haspopup="dialog">ⓘ ¿Qué es?</button>
            </div>
            <p class="simuips-case-narrative">${safe(narrative)}</p>
          </div>`;

        existing?.remove();
        anchor.parentNode.insertBefore(panel, anchor);

        // Sustituir el control antiguo de progreso por el botón «¿Qué es?».
        // Primero ubicamos el botón nuevo y luego buscamos únicamente un control
        // pequeño cuyo texto identifique claramente el progreso del caso.
        const guideButton = panel.querySelector('[data-simuips-what-is-open]');
        const actions = panel.querySelector('.simuips-what-is-actions');

        const progressCandidates = Array.from(document.querySelectorAll(
            'button, [role="button"], .progress-badge, .progress-indicator, ' +
            '.simuips-progress, .case-progress, .progress-label, span, div'
        )).filter(element => {
            if (panel.contains(element)) return false;
            const label = (element.textContent || '').replace(/\s+/g, ' ').trim();
            if (!label || label.length > 90) return false;
            return /progreso/i.test(label) &&
                /\b\d+\s*(?:de|\/)\s*\d+\b/i.test(label);
        });

        // Elegir el elemento más específico, no un contenedor grande de la página.
        const progressElement = progressCandidates
            .filter(element => !progressCandidates.some(other =>
                other !== element && element.contains(other)
            ))
            .sort((a, b) => {
                const aControl = a.matches('button, [role="button"], .progress-badge, .progress-indicator, .simuips-progress, .case-progress, .progress-label') ? 0 : 1;
                const bControl = b.matches('button, [role="button"], .progress-badge, .progress-indicator, .simuips-progress, .case-progress, .progress-label') ? 0 : 1;
                return aControl - bControl || a.textContent.length - b.textContent.length;
            })[0];

        if (guideButton && progressElement) {
            guideButton.classList.add('simuips-progress-guide-button');
            // Marcar el contenedor del indicador para controlar la alineación del botón.
            progressElement.parentElement?.classList.add('simuips-progress-with-guide');
            progressElement.replaceWith(guideButton);
            // El botón ya ocupa el lugar del progreso antiguo: quitar el espacio
            // que lo reservaba debajo del nombre del procedimiento.
            actions?.remove();
        } else if (guideButton && actions) {
            // No dejar una segunda copia debajo del nombre del procedimiento.
            // Si no se encuentra el control de progreso, se retira el botón de
            // esta ubicación para evitar que aparezca duplicado en el caso.
            actions.remove();
        }

        if (guideButton) {
            guideButton.style.setProperty('display', 'inline-flex', 'important');
            guideButton.style.setProperty('visibility', 'visible', 'important');
            guideButton.style.setProperty('opacity', '1', 'important');
            guideButton.style.setProperty('pointer-events', 'auto', 'important');
        }

        // Modal accesible y adaptable a móvil/escritorio. No modifica la liquidación.
        let modalStyle = document.getElementById('simuips-what-is-style');
        if (!modalStyle) {
            modalStyle = document.createElement('style');
            modalStyle.id = 'simuips-what-is-style';
            modalStyle.textContent = `
              .simuips-procedure-row{display:block;width:100%;margin:0}
              .simuips-procedure-row .simuips-case-procedure{display:block;width:100%;margin:0}
              .simuips-what-is-actions{display:flex;align-items:center;justify-content:flex-start;margin-top:10px;margin-bottom:4px}
              .simuips-what-is-btn{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid rgba(45,212,170,.55);border-radius:999px;padding:8px 13px;background:rgba(16,185,129,.12);color:#54e4b6;font-family:inherit;font-size:12px;font-weight:700;line-height:1.2;cursor:pointer;white-space:nowrap}
              .simuips-what-is-btn:hover{background:rgba(16,185,129,.22)}
              .simuips-progress-guide-button{display:flex!important;width:max-content!important;max-width:100%;margin-left:auto!important;margin-right:auto!important;align-self:auto!important;justify-self:auto!important}
              @media(max-width:640px){.simuips-progress-guide-button{margin-left:0!important;margin-right:auto!important}.simuips-what-is-btn{padding:7px 10px;font-size:11px}}
              .simuips-what-is-overlay[hidden]{display:none!important}.simuips-what-is-overlay{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;box-sizing:border-box;z-index:2147483000!important;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(2,6,12,.76);backdrop-filter:blur(5px);margin:0!important}
              .simuips-what-is-dialog{width:min(560px,100%);max-height:min(82vh,720px);overflow:auto;background:#0d141e;color:#edf4ff;border:1px solid rgba(148,163,184,.22);border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.48);padding:22px}
              .simuips-what-is-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
              .simuips-what-is-kicker{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#51ddb0;font-weight:800;margin:0 0 7px}
              .simuips-what-is-dialog h2{font-size:21px;line-height:1.25;margin:0;color:#f8fbff}
              .simuips-what-is-close{width:34px;height:34px;flex:0 0 34px;border:1px solid #344154;border-radius:10px;background:#151f2d;color:#eaf2ff;font-size:21px;cursor:pointer}
              .simuips-what-is-section{margin-top:16px}
              .simuips-what-is-section h3{font-size:13px;margin:0 0 7px;color:#54e4b6}
              .simuips-what-is-section p{font-size:14px;line-height:1.65;margin:0;color:#d8e2f0}
              .simuips-what-is-note{margin-top:18px;padding:12px 13px;border-radius:11px;background:#121f2b;border:1px solid #26384a;color:#aebfd2;font-size:12px;line-height:1.55}
              @media(max-width:520px){.simuips-what-is-overlay{padding:12px;align-items:center}.simuips-what-is-dialog{padding:18px;border-radius:15px;max-height:86vh}.simuips-what-is-dialog h2{font-size:19px}.simuips-what-is-btn{padding:7px 11px}}
            `;
            document.head.appendChild(modalStyle);
        }
        document.getElementById('simuips-what-is-modal')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'simuips-what-is-modal';
        overlay.className = 'simuips-what-is-overlay';
        overlay.hidden = true;
        overlay.setAttribute('role', 'presentation');
        overlay.innerHTML = `
          <section class="simuips-what-is-dialog" role="dialog" aria-modal="true" aria-labelledby="simuips-what-is-title" tabindex="-1">
            <div class="simuips-what-is-top">
              <div><p class="simuips-what-is-kicker">Guía del procedimiento</p><h2 id="simuips-what-is-title">${safe(whatIsTitle)}</h2></div>
              <button type="button" class="simuips-what-is-close" data-simuips-what-is-close aria-label="Cerrar ventana">×</button>
            </div>
            <div class="simuips-what-is-section"><h3>¿Qué es?</h3><p>${safe(whatIsSummary)}</p></div>
            <div class="simuips-what-is-section"><h3>¿Para qué se realiza?</h3><p>${safe(whatIsPurpose)}</p></div>
            ${whatIsNote ? `<div class="simuips-what-is-note">${safe(whatIsNote)}</div>` : ''}
          </section>`;
        // El modal se monta directamente en body para que quede centrado en toda
        // la ventana, no limitado por el panel de liquidación ni sus contenedores.
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100dvh';
        overlay.style.zIndex = '2147483000';
        document.body.appendChild(overlay);
        const openBtn = document.querySelector('[data-simuips-what-is-open]');
        const closeBtn = overlay.querySelector('[data-simuips-what-is-close]');
        const dialog = overlay.querySelector('[role="dialog"]');
        const closeModal = () => {
            overlay.hidden = true;
            openBtn?.focus();
        };
        openBtn?.addEventListener('click', () => {
            overlay.hidden = false;
            dialog?.focus();
        });
        closeBtn?.addEventListener('click', closeModal);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) closeModal();
        });
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeModal();
        });
    }

    function hideDefinitivelyNotApplicableRows(caseData) {
        const studentData = getStudentData(caseData);
        if (!studentData?.displayRules?.hideDefinitivelyNotApplicableComponents) return;

        // Solo ocultamos filas si el caso las identifica explícitamente como no aplicables.
        const liquidation = caseData?.issSolution?.liquidation;
        if (!liquidation || typeof liquidation !== 'object') return;

        const keys = ['surgeon', 'anesthesiologist', 'assistant', 'room', 'materials'];
        const labels = {
            surgeon: /cirujano|cirugía|especialista|honorarios del profesional/i,
            anesthesiologist: /anestesi[oó]logo|anestesia/i,
            assistant: /ayudante|ayudantía|ayudantia/i,
            room: /derechos? de sala|sala de cirugía|sala quirúrgica/i,
            materials: /materiales? de sutura|materiales? de curación|materiales? quirúrgicos/i
        };

        keys.forEach(key => {
            const item = liquidation[key];
            const status = item?.applicability?.status || item?.status;
            if (status !== 'not_applicable' && item?.applicable !== false) return;
            const candidates = Array.from(document.querySelectorAll(
                '#manual-concepts tr, #manual-concepts .concept-row, #manual-concepts [data-concept], ' +
                '#uvr-liquidation-panel tr, #uvr-liquidation-panel .concept-row, #uvr-liquidation-panel [data-concept]'
            ));
            candidates.forEach(row => {
                const haystack = `${row.textContent || ''} ${row.getAttribute('data-concept') || ''} ${row.getAttribute('data-field') || ''}`;
                if (labels[key].test(haystack)) row.style.display = 'none';
            });
        });
    }

    const previousRenderBillingPageStudentMode = renderBillingPage;
    renderBillingPage = function renderBillingPageStudentMode() {
        const result = previousRenderBillingPageStudentMode.apply(this, arguments);
        const caseData = state.currentCase;
        if (!caseData) {
            document.getElementById('simuips-student-case-panel')?.remove();
            return result;
        }
        renderStudentCase(caseData);
        hideDefinitivelyNotApplicableRows(caseData);
        return result;
    };

    // CSS y panel se reaplican también al cambiar de caso si la página ya está visible.
    if (state.currentCase && state.page === 'billing') {
        requestAnimationFrame(() => renderBillingPage());
    }

    console.info('[SimuIPS] Modo estudiante integrado: relato, soportes y CSS incluidos en el JS.');
})();

/* --------------------------------------------------------
   SIMUIPS — MODAL VISUAL PARA DESCARGAR EL MANUAL ISS
   CSS incluido en este mismo JS: no requiere archivo CSS externo.
   El PDF debe publicarse en la raíz como MANUAL-ISS.pdf.
-------------------------------------------------------- */
(function installISSManualDownload() {
    if (window.__simuipsISSManualDownloadInstalled) return;
    window.__simuipsISSManualDownloadInstalled = true;

    const style = document.createElement('style');
    style.id = 'simuips-iss-download-styles';
    style.textContent = `
      .simuips-iss-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 22px;
        background: rgba(15, 23, 42, .58);
        -webkit-backdrop-filter: blur(5px);
        backdrop-filter: blur(5px);
        animation: simuipsIssFadeIn .18s ease-out;
      }
      .simuips-iss-modal {
        width: min(100%, 440px);
        overflow: hidden;
        color: #172033;
        background: #fff;
        border: 1px solid rgba(226, 232, 240, .9);
        border-radius: 20px;
        box-shadow: 0 24px 80px rgba(15, 23, 42, .28);
        font-family: inherit;
        animation: simuipsIssModalIn .22s cubic-bezier(.2,.8,.2,1);
      }
      .simuips-iss-modal-top {
        position: relative;
        padding: 27px 28px 22px;
        text-align: center;
        background: linear-gradient(145deg, #f4f8ff 0%, #fff 78%);
      }
      .simuips-iss-modal-close {
        position: absolute;
        top: 13px;
        right: 13px;
        display: grid;
        width: 34px;
        height: 34px;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: 10px;
        color: #64748b;
        background: transparent;
        font-size: 23px;
        line-height: 1;
        cursor: pointer;
      }
      .simuips-iss-modal-close:hover { background: #e9eef7; color: #172033; }
      .simuips-iss-modal-icon {
        display: grid;
        width: 64px;
        height: 64px;
        margin: 0 auto 16px;
        place-items: center;
        border: 1px solid #d8e5ff;
        border-radius: 19px;
        color: #2458a6;
        background: #eaf1ff;
      }
      .simuips-iss-modal-icon svg { width: 31px; height: 31px; }
      .simuips-iss-modal-eyebrow {
        margin: 0 0 7px;
        color: #3764a5;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      .simuips-iss-modal-title {
        margin: 0;
        color: #172033;
        font-size: clamp(21px, 4vw, 25px);
        font-weight: 800;
        line-height: 1.2;
        letter-spacing: -.035em;
      }
      .simuips-iss-modal-description {
        max-width: 330px;
        margin: 10px auto 0;
        color: #64748b;
        font-size: 14px;
        line-height: 1.55;
      }
      .simuips-iss-file {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0 24px;
        padding: 14px;
        border: 1px solid #e5eaf2;
        border-radius: 13px;
        background: #f8fafc;
      }
      .simuips-iss-file-icon {
        display: grid;
        flex: 0 0 42px;
        width: 42px;
        height: 46px;
        place-items: center;
        border-radius: 10px;
        color: #b42318;
        background: #feeceb;
        font-size: 12px;
        font-weight: 900;
      }
      .simuips-iss-file-name {
        overflow-wrap: anywhere;
        margin: 0;
        color: #273449;
        font-size: 13px;
        font-weight: 750;
      }
      .simuips-iss-file-meta {
        margin: 4px 0 0;
        color: #8490a3;
        font-size: 12px;
      }
      .simuips-iss-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 22px 24px 24px;
      }
      .simuips-iss-btn {
        display: inline-flex;
        min-height: 43px;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 0 17px;
        border: 1px solid transparent;
        border-radius: 11px;
        font: inherit;
        font-size: 13px;
        font-weight: 750;
        cursor: pointer;
        transition: transform .15s ease, background .15s ease, box-shadow .15s ease;
      }
      .simuips-iss-btn:active { transform: translateY(1px); }
      .simuips-iss-btn:focus-visible,
      .simuips-iss-modal-close:focus-visible {
        outline: 3px solid #93b4f7;
        outline-offset: 3px;
      }
      .simuips-iss-btn-cancel {
        color: #475569;
        border-color: #dbe2ec;
        background: #fff;
      }
      .simuips-iss-btn-cancel:hover { background: #f1f5f9; }
      .simuips-iss-btn-download {
        color: #fff;
        background: #2458a6;
        box-shadow: 0 5px 12px rgba(36, 88, 166, .18);
      }
      .simuips-iss-btn-download:hover {
        background: #1d4788;
        box-shadow: 0 7px 17px rgba(36, 88, 166, .25);
      }
      @keyframes simuipsIssFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes simuipsIssModalIn {
        from { opacity: 0; transform: translateY(9px) scale(.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @media (max-width: 480px) {
        .simuips-iss-modal-backdrop { padding: 14px; }
        .simuips-iss-modal-top { padding: 25px 20px 20px; }
        .simuips-iss-file { margin: 0 17px; }
        .simuips-iss-modal-actions { padding: 18px 17px 20px; }
        .simuips-iss-btn { flex: 1; padding: 0 10px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .simuips-iss-modal-backdrop, .simuips-iss-modal { animation: none; }
        .simuips-iss-btn { transition: none; }
      }
    `;
    document.head.appendChild(style);

    let previousFocus = null;

    function closeModal() {
        const backdrop = document.getElementById('simuips-iss-download-backdrop');
        if (backdrop) backdrop.remove();
        document.removeEventListener('keydown', onKeyDown);
        previousFocus?.focus?.();
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') closeModal();
    }

    function openModal() {
        if (document.getElementById('simuips-iss-download-backdrop')) return;
        previousFocus = document.activeElement;

        const backdrop = document.createElement('div');
        backdrop.id = 'simuips-iss-download-backdrop';
        backdrop.className = 'simuips-iss-modal-backdrop';
        backdrop.innerHTML = `
          <section class="simuips-iss-modal" role="dialog" aria-modal="true"
                   aria-labelledby="simuips-iss-modal-title"
                   aria-describedby="simuips-iss-modal-description">
            <div class="simuips-iss-modal-top">
              <button class="simuips-iss-modal-close" type="button"
                      data-iss-modal-close aria-label="Cerrar ventana">×</button>
              <div class="simuips-iss-modal-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M7 3.8h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5.3A1.5 1.5 0 0 1 7.5 3.8Z"/>
                  <path d="M14 4v4h4M12 11v6m-2.5-2.5L12 17l2.5-2.5"/>
                </svg>
              </div>
              <p class="simuips-iss-modal-eyebrow">Biblioteca de consulta</p>
              <h2 class="simuips-iss-modal-title" id="simuips-iss-modal-title">Manual ISS 2000</h2>
              <p class="simuips-iss-modal-description" id="simuips-iss-modal-description">
                Descarga el documento en PDF para consultar códigos, tarifas y reglas del manual durante tu práctica.
              </p>
            </div>
            <div class="simuips-iss-file">
              <div class="simuips-iss-file-icon" aria-hidden="true">PDF</div>
              <div>
                <p class="simuips-iss-file-name">MANUAL-ISS.pdf</p>
                <p class="simuips-iss-file-meta">Documento PDF · Manual de referencia</p>
              </div>
            </div>
            <div class="simuips-iss-modal-actions">
              <button class="simuips-iss-btn simuips-iss-btn-cancel"
                      type="button" data-iss-modal-close>Cancelar</button>
              <button class="simuips-iss-btn simuips-iss-btn-download"
                      type="button" data-iss-modal-download>
                <span aria-hidden="true">↓</span> Descargar PDF
              </button>
            </div>
          </section>`;

        backdrop.addEventListener('click', event => {
            if (event.target === backdrop || event.target.closest('[data-iss-modal-close]')) {
                closeModal();
            }
            if (event.target.closest('[data-iss-modal-download]')) {
                const link = document.createElement('a');
                link.href = './MANUAL-ISS.pdf';
                link.download = 'MANUAL-ISS.pdf';
                link.rel = 'noopener';
                document.body.appendChild(link);
                link.click();
                link.remove();
                closeModal();
            }
        });

        document.body.appendChild(backdrop);
        document.addEventListener('keydown', onKeyDown);
        backdrop.querySelector('[data-iss-modal-download]')?.focus();
    }

    document.addEventListener('click', function (event) {
        const button = event.target.closest('[data-action="download-iss-manual"]');
        if (!button) return;
        event.preventDefault();
        openModal();
    });
})();

