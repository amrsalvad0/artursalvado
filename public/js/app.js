// Conectar ao Socket.IO
const socket = io();

// Variáveis globais
let meetings = [];
let tasks = [];
let backups = [];
let containers = [];
let expeditions = [];
let vehicles = [];
let reservations = [];
let maintenance = [];
let currentMeeting = null;

// Helpers
function normalizeText(s) {
    return (s || '')
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function isMaritime(container) {
    const type = normalizeText(container?.cargo_type);
    // Verificar explicitamente se é do tipo MARÍTIMA
    return type.includes('marit');
}

// Elementos DOM
const sidebar = document.getElementById('sidebar');
const toggleSidebar = document.getElementById('toggleSidebar');
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

// Modais
const meetingModal = document.getElementById('meetingModal');
const taskModal = document.getElementById('taskModal');
const activeMeetingModal = document.getElementById('activeMeetingModal');
const containerModal = document.getElementById('containerModal');
const vehicleModal = document.getElementById('vehicleModal');
const reservationModal = document.getElementById('reservationModal');
const maintenanceModal = document.getElementById('maintenanceModal');

// Botões
const addMeetingBtn = document.getElementById('addMeetingBtn');
const addTaskBtn = document.getElementById('addTaskBtn');
const createBackupBtn = document.getElementById('createBackupBtn');
const cleanOldBackupsBtn = document.getElementById('cleanOldBackupsBtn');
const importExcelBtn = document.getElementById('importExcelBtn');

// Elementos de Relatórios
const reportVehicleSelect = document.getElementById('reportVehicleSelect');
const reportDateFrom = document.getElementById('reportDateFrom');
const reportDateTo = document.getElementById('reportDateTo');
const generateReportBtn = document.getElementById('generateReportBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const reportContent = document.getElementById('reportContent');

// Formulários
const meetingForm = document.getElementById('meetingForm');
const taskForm = document.getElementById('taskForm');

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadData();
});

function initializeApp() {
    // Configurar navegação
    setupNavigation();
    
    // Configurar modais
    setupModals();
    
    // Verificar reuniões ativas
    checkActiveMeetings();
    
    // Verificar reservas expiradas
    checkExpiredReservations();
    
    // Configurar timer para verificar reuniões
    setInterval(checkActiveMeetings, 60000); // Verificar a cada minuto
    
    // Configurar timer para verificar reservas expiradas
    setInterval(checkExpiredReservations, 60000); // Verificar a cada minuto
    
    // Inicializar estado das seções expandíveis
    initializeExpandableSections();
}

function initializeExpandableSections() {
    // Definir estado inicial da seção de reuniões como visível
    const meetingsSection = document.querySelector('.recent-section');
    const expandIcon = document.getElementById('meetingsExpandIcon');
    
    if (meetingsSection && expandIcon) {
        // A seção está visível por padrão, então o ícone deve estar "rotado" (para cima)
        meetingsSection.style.display = 'block';
        meetingsSection.classList.remove('manually-hidden');
        expandIcon.parentElement.classList.add('rotated');
    }
    
    // Definir estado inicial da seção de tarefas como oculta
    const tasksSection = document.getElementById('tasksAlertsSection');
    const tasksExpandIcon = document.getElementById('tasksExpandIcon');
    
    if (tasksSection && tasksExpandIcon) {
        tasksSection.style.display = 'none';
        tasksSection.classList.add('manually-hidden');
        tasksExpandIcon.parentElement.classList.remove('rotated');
    }
}

function setupEventListeners() {
    // Toggle sidebar
    toggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    // Botões de ação
    addMeetingBtn.addEventListener('click', () => openMeetingModal());
    addTaskBtn.addEventListener('click', () => openTaskModal());
    createBackupBtn.addEventListener('click', createBackup);
    cleanOldBackupsBtn.addEventListener('click', cleanOldBackups);

    // Botão de colapso dos alertas de contentores
    const collapseAlertsBtn = document.getElementById('collapseAlertsBtn');
    if (collapseAlertsBtn) {
        collapseAlertsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAlertsCollapse();
        });
    }

    // Botão de colapso dos alertas de expedições
    const collapseExpeditionsBtn = document.getElementById('collapseExpeditionsBtn');
    if (collapseExpeditionsBtn) {
        collapseExpeditionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleExpeditionsCollapse();
        });
    }

    // Botão de colapso das reuniões
    const collapseMeetingsBtn = document.getElementById('collapseMeetingsBtn');
    if (collapseMeetingsBtn) {
        collapseMeetingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMeetingsCollapse();
        });
    }

    // Botão de colapso das tarefas
    const collapseTasksBtn = document.getElementById('collapseTasksBtn');
    if (collapseTasksBtn) {
        collapseTasksBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTasksCollapse();
        });
    }

    // Botão de colapso das viaturas reservadas
    const collapseReservedVehiclesBtn = document.getElementById('collapseReservedVehiclesBtn');
    if (collapseReservedVehiclesBtn) {
        collapseReservedVehiclesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleReservedVehiclesCollapse();
        });
    }

    // Formulários
    meetingForm.addEventListener('submit', handleMeetingSubmit);
    taskForm.addEventListener('submit', handleTaskSubmit);

    // Filtros de tarefas
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            filterTasks(e.target.dataset.filter);
        });
    });

    // Socket events
    socket.on('new-note', (noteData) => {
        addNoteToUI(noteData);
    });

    // Notas de reunião
    const addNoteBtn = document.getElementById('addNoteBtn');
    const newNoteTextarea = document.getElementById('newNote');
    
    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', () => {
            const content = newNoteTextarea.value.trim();
            if (content && currentMeeting) {
                socket.emit('meeting-note', {
                    meetingId: currentMeeting.id,
                    content: content
                });
                newNoteTextarea.value = '';
            }
        });
    }

    // Criar tarefa da reunião
    const createTaskFromMeetingBtn = document.getElementById('createTaskFromMeetingBtn');
    if (createTaskFromMeetingBtn) {
        createTaskFromMeetingBtn.addEventListener('click', () => {
            closeModal(activeMeetingModal);
            openTaskModal(currentMeeting.id);
        });
    }

    // Criar tarefa a partir da nota atual
    const createTaskFromNoteBtn = document.getElementById('createTaskFromNoteBtn');
    if (createTaskFromNoteBtn) {
        createTaskFromNoteBtn.addEventListener('click', () => {
            createTaskFromCurrentNote();
        });
    }

    // Editar reunião
    const editMeetingBtn = document.getElementById('editMeetingBtn');
    if (editMeetingBtn) {
        editMeetingBtn.addEventListener('click', () => {
            closeModal(activeMeetingModal);
            editMeeting(currentMeeting);
        });
    }

    // Terminar reunião
    const endMeetingBtn = document.getElementById('endMeetingBtn');
    if (endMeetingBtn) {
        endMeetingBtn.addEventListener('click', () => {
            if (currentMeeting) {
                endCurrentMeeting();
            }
        });
    }

    // Event listeners para relatórios
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateVehicleReport);
    }

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportReportToPdf);
    }

    if (reportVehicleSelect) {
        reportVehicleSelect.addEventListener('change', function() {
            exportPdfBtn.disabled = !this.value;
            if (!this.value) {
                reportContent.style.display = 'none';
            }
        });
    }
}

function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.dataset.page;
            showPage(pageId);
            
            // Atualizar item ativo
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

function showPage(pageId) {
    pages.forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    // Carregar dados específicos da página
    switch(pageId) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'meetings':
            loadMeetings();
            break;
        case 'tasks':
            loadTasks();
            break;
        case 'containers':
            loadContainers();
            break;
        case 'expeditions':
            loadExpeditions();
            break;
        case 'backup':
            loadBackups();
            break;
    }
}

function setupModals() {
    // Fechar modais
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            closeModal(modal);
        });
    });

    // Fechar modal clicando fora
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });

    // Botões cancelar
    document.getElementById('cancelMeeting')?.addEventListener('click', () => {
        closeModal(meetingModal);
    });
    
    document.getElementById('cancelTask')?.addEventListener('click', () => {
        closeModal(taskModal);
    });
    
    // Event listener para checkbox de recorrência
    const isRecurringCheckbox = document.getElementById('isRecurring');
    const recurrenceOptions = document.getElementById('recurrenceOptions');
    
    if (isRecurringCheckbox && recurrenceOptions) {
        isRecurringCheckbox.addEventListener('change', function() {
            if (this.checked) {
                recurrenceOptions.style.display = 'block';
                recurrenceOptions.classList.add('fade-in');
                recurrenceOptions.classList.remove('fade-out');
                
                // Definir data mínima para fim de recorrência
                const meetingDate = document.getElementById('meetingDate');
                const recurrenceEndDate = document.getElementById('recurrenceEndDate');
                
                if (meetingDate.value && recurrenceEndDate) {
                    const startDate = new Date(meetingDate.value);
                    startDate.setDate(startDate.getDate() + 1); // Mínimo um dia depois
                    recurrenceEndDate.min = startDate.toISOString().split('T')[0];
                    
                    // Sugerir data padrão (3 meses depois)
                    if (!recurrenceEndDate.value) {
                        const suggestedEnd = new Date(meetingDate.value);
                        suggestedEnd.setMonth(suggestedEnd.getMonth() + 3);
                        recurrenceEndDate.value = suggestedEnd.toISOString().split('T')[0];
                    }
                }
            } else {
                recurrenceOptions.classList.add('fade-out');
                recurrenceOptions.classList.remove('fade-in');
                setTimeout(() => {
                    recurrenceOptions.style.display = 'none';
                }, 300);
            }
        });
    }
    
    // Event listener para mudança na data da reunião
    const meetingDate = document.getElementById('meetingDate');
    if (meetingDate) {
        meetingDate.addEventListener('change', function() {
            const isRecurringCheckbox = document.getElementById('isRecurring');
            const recurrenceEndDate = document.getElementById('recurrenceEndDate');
            
            if (isRecurringCheckbox?.checked && this.value && recurrenceEndDate) {
                const startDate = new Date(this.value);
                startDate.setDate(startDate.getDate() + 1);
                recurrenceEndDate.min = startDate.toISOString().split('T')[0];
            }
        });
    }
    
    // Setup telefones event listeners
    setupPhonesEventListeners();
}

function openModal(modal) {
    console.log('openModal chamada com:', modal);
    if (!modal) {
        console.error('Modal é null ou undefined!');
        return;
    }
    console.log('Definindo display para block...');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    console.log('Modal aberto, display:', modal.style.display);
}

function closeModal(modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function openMeetingModal() {
    meetingForm.reset();
    
    // Limpar dataset de edição
    delete meetingForm.dataset.editId;
    
    // Resetar título do modal e botão
    const modalTitle = document.querySelector('#meetingModal .modal-header h2');
    const submitButton = document.querySelector('#meetingModal button[type="submit"]');
    modalTitle.textContent = 'Nova Reunião';
    submitButton.textContent = 'Criar Reunião';
    
    // Reset opções de recorrência
    document.getElementById('isRecurring').checked = false;
    document.getElementById('recurrenceOptions').style.display = 'none';
    document.getElementById('recurrenceType').value = 'weekly';
    document.getElementById('recurrenceInterval').value = 1;
    document.getElementById('recurrenceEndDate').value = '';
    
    // Definir data/hora padrão para agora
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('meetingDate').value = now.toISOString().slice(0,16);
    
    openModal(meetingModal);
}

function openTaskModal(meetingId = null, taskTitle = '') {
    taskForm.reset();
    
    // Resetar título do modal e botão
    const modalTitle = document.querySelector('#taskModal .modal-header h2');
    const submitButton = document.querySelector('#taskModal button[type="submit"]');
    modalTitle.textContent = 'Nova Tarefa';
    submitButton.textContent = 'Criar Tarefa';
    
    // Limpar dataset de edição
    delete taskForm.dataset.editId;
    
    // Se for criado a partir de uma reunião, definir a reunião
    if (meetingId) {
        taskForm.dataset.meetingId = meetingId;
    } else {
        delete taskForm.dataset.meetingId;
    }
    
    // Se foi fornecido um título, preencher o campo
    if (taskTitle) {
        document.getElementById('taskTitle').value = taskTitle;
    }
    
    openModal(taskModal);
}

async function loadData() {
    try {
        await Promise.all([
            loadMeetings(),
            loadTasks(),
            loadBackups(),
            loadContainers(),
            loadExpeditions(),
            loadPhones()
        ]);
        updateDashboard();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showNotification('Erro ao carregar dados', 'error');
    }
}

async function loadMeetings() {
    console.log('loadMeetings chamada');
    try {
        const response = await fetch('/api/meetings');
        meetings = await response.json();
        console.log('Reuniões carregadas:', meetings);
        renderMeetings();
        return meetings;
    } catch (error) {
        console.error('Erro ao carregar reuniões:', error);
        showNotification('Erro ao carregar reuniões', 'error');
    }
}

async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        tasks = await response.json();
        renderTasks();
        return tasks;
    } catch (error) {
        console.error('Erro ao carregar tarefas:', error);
        showNotification('Erro ao carregar tarefas', 'error');
    }
}

async function loadBackups() {
    try {
        const response = await fetch('/api/backups');
        backups = await response.json();
        renderBackups();
        return backups;
    } catch (error) {
        console.error('Erro ao carregar backups:', error);
        showNotification('Erro ao carregar backups', 'error');
    }
}

function renderMeetings() {
    console.log('renderMeetings chamada, reuniões:', meetings);
    const meetingsList = document.getElementById('meetingsList');
    const recentMeetings = document.getElementById('recentMeetings');
    
    if (!meetingsList) {
        console.log('meetingsList não encontrado');
        return;
    }
    
    meetingsList.innerHTML = '';
    
    if (meetings.length === 0) {
        console.log('Nenhuma reunião encontrada');
        meetingsList.innerHTML = '<div style="text-align: center; padding: 40px; color: #7f8c8d;">Nenhuma reunião agendada</div>';
        return;
    }
    
    console.log('Renderizando', meetings.length, 'reuniões');
    meetings.forEach((meeting, index) => {
        console.log(`Criando elemento para reunião ${index}:`, meeting.title);
        const meetingElement = createMeetingElement(meeting);
        meetingsList.appendChild(meetingElement);
    });
    
    // Renderizar reuniões recentes no dashboard
    if (recentMeetings) {
        recentMeetings.innerHTML = '';
        const upcomingMeetings = meetings
            .filter(m => new Date(m.date_time) > new Date())
            .slice(0, 3);
            
        upcomingMeetings.forEach(meeting => {
            const meetingElement = createMeetingElement(meeting, true);
            recentMeetings.appendChild(meetingElement);
        });
    }
}

function createMeetingElement(meeting, isCompact = false) {
    const div = document.createElement('div');
    div.className = 'meeting-item';
    
    const date = new Date(meeting.date_time);
    const formattedDate = date.toLocaleDateString('pt-PT');
    const formattedTime = date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    
    // Indicador de recorrência
    const recurrenceIndicator = (meeting.is_recurring || meeting.parent_meeting_id) ? 
        '<span class="meeting-recurrence-indicator"><i class="fas fa-redo"></i> Recorrente</span>' : '';
    
    div.innerHTML = `
        <div class="meeting-header">
            <div class="meeting-content" onclick="openMeetingDetails('${meeting.id}')">
                <div class="meeting-title">
                    ${meeting.title}
                    ${recurrenceIndicator}
                </div>
                <div class="meeting-time">${formattedDate} às ${formattedTime}</div>
                ${!isCompact && meeting.description ? `<div style="color: #7f8c8d; margin-top: 5px;">${meeting.description}</div>` : ''}
            </div>
            <div class="meeting-actions">
                <span class="meeting-status status-${meeting.status}">${getStatusText(meeting.status)}</span>
                ${!isCompact ? `
                    <div class="meeting-buttons">
                        ${meeting.status !== 'completed' ? `
                            <button class="btn-icon btn-success" onclick="event.stopPropagation(); markMeetingAsCompleted('${meeting.id}')" title="Marcar como concluída">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                        <button class="btn-icon btn-primary" onclick="event.stopPropagation(); editMeeting('${meeting.id}')" title="Editar reunião">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-danger" onclick="event.stopPropagation(); deleteMeeting('${meeting.id}', ${meeting.is_recurring || meeting.parent_meeting_id})" title="Eliminar reunião">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    return div;
}

function renderTasks() {
    const tasksList = document.getElementById('tasksList');
    if (!tasksList) return;
    
    tasksList.innerHTML = '';
    
    if (tasks.length === 0) {
        tasksList.innerHTML = '<div style="text-align: center; padding: 40px; color: #7f8c8d;">Nenhuma tarefa criada</div>';
        return;
    }
    
    tasks.forEach(task => {
        const taskElement = createTaskElement(task);
        tasksList.appendChild(taskElement);
    });
}

function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = `task-item priority-${task.priority}`;
    
    let dueDateText = '';
    if (task.due_date) {
        const dueDate = new Date(task.due_date);
        dueDateText = `Prazo: ${dueDate.toLocaleDateString('pt-PT')} às ${dueDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    div.innerHTML = `
        <div class="task-header">
            <div class="task-content" onclick="openTaskDetails('${task.id}')">
                <div class="task-title">${task.title}</div>
                ${task.description ? `<div style="color: #7f8c8d; margin-top: 5px;">${task.description}</div>` : ''}
                ${dueDateText ? `<div class="task-due">${dueDateText}</div>` : ''}
            </div>
            <div class="task-actions">
                <span class="task-status status-${task.status}">${getStatusText(task.status)}</span>
                <div class="task-buttons">
                    ${task.status !== 'completed' ? `<button class="btn-icon btn-success" onclick="event.stopPropagation(); toggleTaskStatus('${task.id}')" title="Marcar como concluída">
                        <i class="fas fa-check"></i>
                    </button>` : `<button class="btn-icon btn-warning" onclick="event.stopPropagation(); toggleTaskStatus('${task.id}')" title="Marcar como pendente">
                        <i class="fas fa-undo"></i>
                    </button>`}
                    <button class="btn-icon btn-primary" onclick="event.stopPropagation(); editTask('${task.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-danger" onclick="event.stopPropagation(); deleteTask('${task.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    return div;
}

function renderBackups() {
    const backupList = document.getElementById('backupList');
    if (!backupList) return;
    
    backupList.innerHTML = '';
    
    if (backups.length === 0) {
        backupList.innerHTML = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">Nenhum backup encontrado</div>';
        return;
    }
    
    backups.forEach(backup => {
        const backupElement = createBackupElement(backup);
        backupList.appendChild(backupElement);
    });
}

function createBackupElement(backup) {
    const div = document.createElement('div');
    div.className = 'backup-item';
    
    const date = new Date(backup.created_at);
    const formattedDate = date.toLocaleDateString('pt-PT');
    const formattedTime = date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const size = (backup.size / 1024).toFixed(2) + ' KB';
    
    div.innerHTML = `
        <div>
            <div style="font-weight: 500;">${backup.filename}</div>
            <div style="color: #7f8c8d; font-size: 0.9rem;">${formattedDate} às ${formattedTime} - ${size}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <span class="status-${backup.status}">${getStatusText(backup.status)}</span>
            <button class="btn btn-sm btn-warning" onclick="restoreBackup('${backup.id}', '${backup.filename}')" 
                    title="Restaurar este backup">
                <i class="fas fa-undo"></i> Restaurar
            </button>
        </div>
    `;
    
    return div;
}

function updateDashboard() {
    // Atualizar contadores
    const today = new Date().toDateString();
    const meetingsToday = meetings.filter(m => new Date(m.date_time).toDateString() === today).length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    
    // Verificar alertas de contentores PRIMEIRO (antes de atualizar UI)
    if (typeof checkContainerAlerts === 'function') {
        checkContainerAlerts();
    }
    
    // Verificar alertas de expedições se a função existir
    if (typeof checkExpeditionAlerts === 'function') {
        checkExpeditionAlerts();
    }
    
    // Atualizar estatísticas da frota
    if (typeof updateFleetStats === 'function') {
        updateFleetStats();
    }
    
    // Carregar alertas de manutenção
    if (typeof loadMaintenanceAlerts === 'function') {
        loadMaintenanceAlerts();
    }

    // Carregar alertas de viaturas reservadas
    if (typeof loadReservedVehiclesAlerts === 'function') {
        loadReservedVehiclesAlerts();
    }
    
    // Carregar reuniões de hoje
    loadTodayMeetings();
    
    // Carregar tarefas pendentes
    loadPendingTasks();
    
    // Atualizar banner do dashboard (DEPOIS de verificar alertas)
    updateDashboardBanner();
}

// Função para carregar reuniões de hoje na seção de alertas
function loadTodayMeetings() {
    const meetingsList = document.getElementById('meetingsAlertsList');
    if (!meetingsList) return;
    
    const today = new Date();
    const todayStr = today.toDateString();
    
    const todayMeetings = meetings.filter(meeting => {
        const meetingDate = new Date(meeting.date_time);
        return meetingDate.toDateString() === todayStr;
    });
    
    if (todayMeetings.length === 0) {
        meetingsList.innerHTML = '<p class="no-items">Nenhuma reunião hoje.</p>';
        return;
    }
    
    meetingsList.innerHTML = todayMeetings.map(meeting => {
        const meetingTime = new Date(meeting.date_time);
        const timeStr = meetingTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        const statusClass = meeting.status === 'active' ? 'status-active' : 
                           meeting.status === 'completed' ? 'status-completed' : 'status-scheduled';
        
        return `
            <div class="alert-item meeting-alert">
                <div class="alert-icon">
                    <i class="fas fa-calendar-check"></i>
                </div>
                <div class="alert-content">
                    <h4>${meeting.title}</h4>
                    <p><i class="fas fa-clock"></i> ${timeStr}</p>
                    ${meeting.location ? `<p><i class="fas fa-map-marker-alt"></i> ${meeting.location}</p>` : ''}
                    <span class="alert-status ${statusClass}">${getStatusText(meeting.status)}</span>
                </div>
                <div class="alert-actions">
                    <button class="btn btn-sm btn-primary" onclick="editMeeting('${meeting.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Função para carregar tarefas pendentes na seção de alertas
function loadPendingTasks() {
    const tasksList = document.getElementById('tasksAlertsList');
    if (!tasksList) return;
    
    const pendingTasks = tasks.filter(task => task.status === 'pending');
    
    if (pendingTasks.length === 0) {
        tasksList.innerHTML = '<p class="no-items">Nenhuma tarefa pendente.</p>';
        return;
    }
    
    tasksList.innerHTML = pendingTasks.map(task => {
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        const isOverdue = dueDate && dueDate < new Date();
        const dueDateStr = dueDate ? dueDate.toLocaleDateString('pt-PT') : 'Sem prazo';
        
        return `
            <div class="alert-item task-alert ${isOverdue ? 'overdue' : ''}">
                <div class="alert-icon">
                    <i class="fas fa-exclamation-circle ${isOverdue ? 'text-danger' : ''}"></i>
                </div>
                <div class="alert-content">
                    <h4>${task.title}</h4>
                    ${task.description ? `<p>${task.description}</p>` : ''}
                    <p><i class="fas fa-calendar"></i> ${dueDateStr}</p>
                    <span class="alert-priority priority-${task.priority}">${getPriorityText(task.priority)}</span>
                </div>
                <div class="alert-actions">
                    <button class="btn btn-sm btn-success" onclick="completeTask('${task.id}')" title="Marcar como concluída">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="editTask('${task.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function checkActiveMeetings() {
    const now = new Date();
    meetings.forEach(meeting => {
        const meetingTime = new Date(meeting.date_time);
        const endTime = new Date(meetingTime.getTime() + (meeting.duration * 60000));
        
        // Se a reunião deve estar ativa agora
        if (now >= meetingTime && now <= endTime && meeting.status === 'scheduled') {
            startMeeting(meeting);
        }
        
        // Se a reunião terminou
        if (now > endTime && meeting.status === 'active') {
            endMeeting(meeting);
        }
    });
}

async function startMeeting(meeting) {
    try {
        await fetch(`/api/meetings/${meeting.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...meeting, status: 'active' })
        });
        
        meeting.status = 'active';
        currentMeeting = meeting;
        
        showNotification(`Reunião "${meeting.title}" iniciada!`, 'success');
        updateDashboard();
        renderMeetings();
        
        // Juntar-se à sala da reunião no socket
        socket.emit('join-meeting', meeting.id);
        
    } catch (error) {
        console.error('Erro ao iniciar reunião:', error);
    }
}

async function endMeeting(meeting) {
    try {
        await fetch(`/api/meetings/${meeting.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...meeting, status: 'completed' })
        });
        
        meeting.status = 'completed';
        if (currentMeeting && currentMeeting.id === meeting.id) {
            currentMeeting = null;
        }
        
        showNotification(`Reunião "${meeting.title}" terminada!`, 'info');
        updateDashboard();
        renderMeetings();
        
    } catch (error) {
        console.error('Erro ao terminar reunião:', error);
    }
}

function checkExpiredReservations() {
    if (!reservations || reservations.length === 0) return;
    
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Fim do dia atual para comparação
    
    reservations.forEach(reservation => {
        if (reservation.status === 'active') {
            const endDate = new Date(reservation.end_date);
            
            // Se a data de fim já passou, auto-concluir a reserva
            if (endDate < today) {
                console.log(`Auto-concluindo reserva expirada: ${reservation.id} (fim: ${reservation.end_date})`);
                autoCompleteReservation(reservation.id);
            }
        }
    });
}

async function endCurrentMeeting() {
    if (!currentMeeting) return;
    
    await endMeeting(currentMeeting);
    closeModal(activeMeetingModal);
}

function editMeeting(meetingId) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) {
        showNotification('Reunião não encontrada', 'error');
        return;
    }
    
    // Preencher o formulário com os dados da reunião
    document.getElementById('meetingTitle').value = meeting.title;
    document.getElementById('meetingDescription').value = meeting.description || '';
    
    // Converter a data para o formato necessário para o input datetime-local
    const date = new Date(meeting.date_time);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    document.getElementById('meetingDate').value = date.toISOString().slice(0,16);
    
    document.getElementById('meetingDuration').value = meeting.duration || 60;
    
    // Atualizar título do modal e botão
    const modalTitle = document.querySelector('#meetingModal .modal-header h2');
    const submitButton = document.querySelector('#meetingModal button[type="submit"]');
    modalTitle.textContent = 'Editar Reunião';
    submitButton.textContent = 'Atualizar Reunião';
    
    // Adicionar o ID da reunião ao formulário para identificar que é uma edição
    meetingForm.dataset.editId = meetingId;
    
    openModal(meetingModal);
}

async function deleteMeeting(meetingId, isRecurring = false) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) {
        showNotification('Reunião não encontrada', 'error');
        return;
    }
    
    let confirmMessage = `Tem a certeza que deseja eliminar a reunião "${meeting.title}"?`;
    let deleteAll = false;
    
    if (isRecurring) {
        const choice = confirm(
            `Esta reunião faz parte de uma série recorrente.\n\n` +
            `Clique "OK" para eliminar TODA a série de reuniões.\n` +
            `Clique "Cancelar" para eliminar apenas esta reunião.`
        );
        
        if (choice === null) return; // User cancelled completely
        
        deleteAll = choice;
        
        if (deleteAll) {
            confirmMessage = `Tem a certeza que deseja eliminar TODA a série de reuniões "${meeting.title}"?`;
        } else {
            confirmMessage = `Tem a certeza que deseja eliminar apenas esta reunião "${meeting.title}"?`;
        }
        
        if (!confirm(confirmMessage)) {
            return;
        }
    } else {
        if (!confirm(confirmMessage)) {
            return;
        }
    }
    
    try {
        const url = deleteAll ? `/api/meetings/${meetingId}?deleteAll=true` : `/api/meetings/${meetingId}`;
        const response = await fetch(url, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            const result = await response.json();
            
            if (deleteAll && result.deleted_count > 1) {
                showNotification(`${result.deleted_count} reuniões eliminadas com sucesso!`, 'success');
            } else {
                showNotification('Reunião eliminada com sucesso!', 'success');
            }
            
            await loadMeetings();
            updateDashboard();
        } else {
            throw new Error('Erro ao eliminar reunião');
        }
    } catch (error) {
        console.error('Erro ao eliminar reunião:', error);
        showNotification('Erro ao eliminar reunião', 'error');
    }
}

function openMeetingDetails(meetingId) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) {
        showNotification('Reunião não encontrada', 'error');
        return;
    }
    
    console.log('openMeetingDetails chamada para:', meeting.title);
    // Sempre abrir o ambiente de apontamentos, independente do status
    openMeetingNotesModal(meeting);
}

async function openMeetingNotesModal(meeting) {
    console.log('openMeetingNotesModal chamada para:', meeting.title);
    currentMeeting = meeting;
    
    // Verificar se o modal existe
    const modalElement = document.getElementById('activeMeetingModal');
    console.log('Modal element:', modalElement);
    
    if (!modalElement) {
        console.error('Modal activeMeetingModal não encontrado!');
        return;
    }
    
    // Atualizar título do modal
    const titleElement = document.getElementById('activeMeetingTitle');
    console.log('Title element:', titleElement);
    
    if (titleElement) {
        titleElement.textContent = `${meeting.title} - Apontamentos`;
        console.log('Título atualizado para:', titleElement.textContent);
    }
    
    // Atualizar status da reunião se não estiver ativa
    if (meeting.status !== 'active') {
        console.log('Atualizando status da reunião para active');
        try {
            await updateMeetingStatus(meeting.id, 'active');
            meeting.status = 'active';
            renderMeetings(); // Atualizar a lista de reuniões
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
        }
    }
    
    // Carregar notas da reunião
    console.log('Carregando notas da reunião...');
    await loadMeetingNotes(meeting.id);
    
    // Juntar-se à sala da reunião
    socket.emit('join-meeting', meeting.id);
    
    console.log('Abrindo modal de reunião ativa');
    openModal(modalElement);
}

async function loadMeetingNotes(meetingId) {
    try {
        const response = await fetch(`/api/meetings/${meetingId}/notes`);
        const notes = await response.json();
        
        const notesContainer = document.getElementById('notesContainer');
        notesContainer.innerHTML = '';
        
        notes.forEach(note => {
            addNoteToUI(note);
        });
        
    } catch (error) {
        console.error('Erro ao carregar notas:', error);
    }
}

function addNoteToUI(noteData) {
    const notesContainer = document.getElementById('notesContainer');
    const noteElement = document.createElement('div');
    noteElement.className = 'note-item';
    
    const time = new Date(noteData.timestamp).toLocaleTimeString('pt-PT', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    noteElement.innerHTML = `
        <div class="note-time">${time}</div>
        <div class="note-content">${noteData.content}</div>
    `;
    
    notesContainer.appendChild(noteElement);
    notesContainer.scrollTop = notesContainer.scrollHeight;
}

async function updateMeetingStatus(meetingId, status) {
    try {
        const response = await fetch(`/api/meetings/${meetingId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) {
            throw new Error('Erro ao atualizar status da reunião');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        throw error;
    }
}

async function markMeetingAsCompleted(meetingId) {
    try {
        // Encontrar a reunião na lista local
        const meeting = meetings.find(m => m.id === meetingId);
        if (!meeting) {
            console.error('Reunião não encontrada');
            return;
        }
        
        // Confirmar a ação
        if (!confirm(`Tem a certeza que deseja marcar a reunião "${meeting.title}" como concluída?`)) {
            return;
        }
        
        // Atualizar o status no servidor
        await updateMeetingStatus(meetingId, 'completed');
        
        // Atualizar o status local
        meeting.status = 'completed';
        
        // Re-renderizar as reuniões
        renderMeetings();
        loadTodayMeetings();
        
        // Mostrar notificação de sucesso
        showNotification('Reunião marcada como concluída com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao marcar reunião como concluída:', error);
        showNotification('Erro ao marcar reunião como concluída', 'error');
    }
}

function createTaskFromCurrentNote() {
    const noteText = document.getElementById('newNote').value.trim();
    
    if (!noteText) {
        alert('Por favor, escreva um apontamento antes de criar uma tarefa.');
        return;
    }
    
    // Usar o texto da nota como título da tarefa
    closeModal(activeMeetingModal);
    openTaskModal(currentMeeting.id, noteText);
    
    // Limpar o campo de nota
    document.getElementById('newNote').value = '';
}

function openTaskDetails(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        editTask(taskId);
    }
}

function editMeeting(meeting) {
    // Preencher formulário com dados da reunião
    document.getElementById('meetingTitle').value = meeting.title;
    document.getElementById('meetingDescription').value = meeting.description || '';
    
    const date = new Date(meeting.date_time);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    document.getElementById('meetingDate').value = date.toISOString().slice(0,16);
    document.getElementById('meetingDuration').value = meeting.duration;
    
    meetingForm.dataset.editId = meeting.id;
    openModal(meetingModal);
}

function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Preencher formulário com dados da tarefa
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskPriority').value = task.priority;
    
    if (task.due_date) {
        const date = new Date(task.due_date);
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        document.getElementById('taskDueDate').value = date.toISOString().slice(0,16);
    }
    
    // Atualizar título do modal e botão
    const modalTitle = document.querySelector('#taskModal .modal-header h2');
    const submitButton = document.querySelector('#taskModal button[type="submit"]');
    modalTitle.textContent = 'Editar Tarefa';
    submitButton.textContent = 'Atualizar Tarefa';
    
    taskForm.dataset.editId = task.id;
    openModal(taskModal);
}

async function handleMeetingSubmit(e) {
    e.preventDefault();
    
    const meetingData = {
        title: document.getElementById('meetingTitle').value,
        description: document.getElementById('meetingDescription').value,
        date_time: document.getElementById('meetingDate').value,
        duration: parseInt(document.getElementById('meetingDuration').value)
    };
    
    // Verificar se é reunião recorrente
    const isRecurring = document.getElementById('isRecurring').checked;
    if (isRecurring) {
        meetingData.is_recurring = true;
        meetingData.recurrence_type = document.getElementById('recurrenceType').value;
        meetingData.recurrence_interval = parseInt(document.getElementById('recurrenceInterval').value);
        meetingData.recurrence_end_date = document.getElementById('recurrenceEndDate').value;
        
        // Validar data de fim
        if (!meetingData.recurrence_end_date) {
            showNotification('Por favor, defina a data de fim da recorrência', 'error');
            return;
        }
        
        const startDate = new Date(meetingData.date_time);
        const endDate = new Date(meetingData.recurrence_end_date);
        
        if (endDate <= startDate) {
            showNotification('A data de fim deve ser posterior à data da reunião', 'error');
            return;
        }
    }
    
    try {
        const editId = meetingForm.dataset.editId;
        const url = editId ? `/api/meetings/${editId}` : '/api/meetings';
        const method = editId ? 'PUT' : 'POST';
        
        if (editId) {
            // Para edição, manter status e notas existentes
            const existingMeeting = meetings.find(m => m.id === editId);
            meetingData.status = existingMeeting.status;
            meetingData.notes = existingMeeting.notes;
        }
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(meetingData)
        });
        
        if (response.ok) {
            const result = await response.json();
            
            if (isRecurring && !editId) {
                showNotification(`Criadas ${result.meetings_count} reuniões recorrentes!`, 'success');
            } else {
                showNotification(editId ? 'Reunião atualizada!' : 'Reunião criada!', 'success');
            }
            
            closeModal(meetingModal);
            await loadMeetings();
            updateDashboard();
            meetingForm.reset();
            delete meetingForm.dataset.editId;
            
            // Reset recurrence options
            document.getElementById('isRecurring').checked = false;
            document.getElementById('recurrenceOptions').style.display = 'none';
        }
        
    } catch (error) {
        console.error('Erro ao salvar reunião:', error);
        showNotification('Erro ao salvar reunião', 'error');
    }
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    
    const taskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        priority: document.getElementById('taskPriority').value,
        due_date: document.getElementById('taskDueDate').value || null,
        meeting_id: taskForm.dataset.meetingId || null
    };
    
    try {
        const editId = taskForm.dataset.editId;
        const url = editId ? `/api/tasks/${editId}` : '/api/tasks';
        const method = editId ? 'PUT' : 'POST';
        
        if (editId) {
            // Para edição, manter status existente
            const existingTask = tasks.find(t => t.id === editId);
            taskData.status = existingTask.status;
        }
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        
        if (response.ok) {
            showNotification(editId ? 'Tarefa atualizada!' : 'Tarefa criada!', 'success');
            closeModal(taskModal);
            await loadTasks();
            updateDashboard();
            taskForm.reset();
            delete taskForm.dataset.editId;
            delete taskForm.dataset.meetingId;
        }
        
    } catch (error) {
        console.error('Erro ao salvar tarefa:', error);
        showNotification('Erro ao salvar tarefa', 'error');
    }
}

async function toggleTaskStatus(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: task.title,
                description: task.description,
                priority: task.priority,
                status: newStatus,
                due_date: task.due_date
            })
        });
        
        if (response.ok) {
            showNotification(newStatus === 'completed' ? 'Tarefa marcada como concluída!' : 'Tarefa marcada como pendente!', 'success');
            await loadTasks();
            updateDashboard();
        }
        
    } catch (error) {
        console.error('Erro ao atualizar status da tarefa:', error);
        showNotification('Erro ao atualizar status da tarefa', 'error');
    }
}

async function deleteTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    if (!confirm(`Tem certeza que deseja eliminar a tarefa "${task.title}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Tarefa eliminada com sucesso!', 'success');
            await loadTasks();
            updateDashboard();
        }
        
    } catch (error) {
        console.error('Erro ao eliminar tarefa:', error);
        showNotification('Erro ao eliminar tarefa', 'error');
    }
}

async function completeTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...task, status: 'completed' })
        });
        
        if (response.ok) {
            showNotification('Tarefa marcada como concluída!', 'success');
            await loadTasks();
            updateDashboard();
            
            // Se a seção de tarefas estiver aberta, recarregar
            const tasksSection = document.getElementById('tasksAlertsSection');
            if (tasksSection && tasksSection.style.display !== 'none') {
                loadPendingTasks();
            }
        }
        
    } catch (error) {
        console.error('Erro ao completar tarefa:', error);
        showNotification('Erro ao completar tarefa', 'error');
    }
}

function filterTasks(filter) {
    const taskItems = document.querySelectorAll('.task-item');
    
    taskItems.forEach(item => {
        if (filter === 'all') {
            item.style.display = 'block';
        } else {
            const task = tasks.find(t => item.onclick.toString().includes(t.id));
            if (task && task.status === filter) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        }
    });
}

async function createBackup() {
    try {
        createBackupBtn.disabled = true;
        createBackupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';
        
        const response = await fetch('/api/backups', {
            method: 'POST'
        });
        
        if (response.ok) {
            showNotification('Backup criado com sucesso!', 'success');
            await loadBackups();
        }
        
    } catch (error) {
        console.error('Erro ao criar backup:', error);
        showNotification('Erro ao criar backup', 'error');
    } finally {
        createBackupBtn.disabled = false;
        createBackupBtn.innerHTML = '<i class="fas fa-save"></i> Criar Backup';
    }
}

async function cleanOldBackups() {
    const confirmMessage = 'Tem a certeza que deseja apagar todos os backups com mais de 15 dias?\n\nEsta ação não pode ser desfeita e irá libertar espaço em disco.';
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        cleanOldBackupsBtn.disabled = true;
        cleanOldBackupsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Limpando...';
        
        const response = await fetch('/api/backups/cleanup', {
            method: 'DELETE'
        });
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.deletedCount > 0) {
                showNotification(
                    `${result.deletedCount} backup(s) removido(s) com sucesso! Espaço libertado: ${result.spaceSaved} MB`, 
                    'success'
                );
            } else {
                showNotification(result.message, 'info');
            }
            
            await loadBackups();
        } else {
            const error = await response.json();
            showNotification(`Erro ao limpar backups: ${error.error}`, 'error');
        }
        
    } catch (error) {
        console.error('Erro ao limpar backups antigos:', error);
        showNotification('Erro ao limpar backups antigos', 'error');
    } finally {
        cleanOldBackupsBtn.disabled = false;
        cleanOldBackupsBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Limpar Backups Antigos (15+ dias)';
    }
}

async function restoreBackup(backupId, filename) {
    const confirmMessage = `Tem a certeza que deseja restaurar o backup "${filename}"?\n\nAVISO: Esta ação irá substituir todos os dados atuais. Um backup de segurança será criado automaticamente antes da restauração.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        showNotification('Preparando restauração...', 'info');
        
        const response = await fetch(`/api/backups/${backupId}/restore`, {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification('Backup restaurado com sucesso! A página será recarregada.', 'success');
            
            // Aguardar um pouco para mostrar a notificação e depois recarregar
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } else {
            const error = await response.json();
            showNotification(`Erro ao restaurar backup: ${error.error}`, 'error');
        }
        
    } catch (error) {
        console.error('Erro ao restaurar backup:', error);
        showNotification('Erro ao conectar com o servidor', 'error');
    }
}

function getStatusText(status) {
    const statusMap = {
        'scheduled': 'Agendada',
        'active': 'Em Curso',
        'completed': 'Concluída',
        'pending': 'Pendente',
        'in_progress': 'Em Progresso'
    };
    return statusMap[status] || status;
}

function showNotification(message, type = 'info') {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 9999;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    
    // Cores baseadas no tipo
    const colors = {
        success: '#27ae60',
        error: '#e74c3c',
        warning: '#f39c12',
        info: '#3498db'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animar entrada
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Responsividade móvel
function handleMobileNavigation() {
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
        
        // Toggle para mobile
        toggleSidebar.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }
}

window.addEventListener('resize', handleMobileNavigation);
handleMobileNavigation();

// ================================
// FUNCIONALIDADES DE CONTENTORES
// ================================

async function loadContainers() {
    try {
        const response = await fetch('/api/containers');
        containers = await response.json();
    renderContainers();
        updateContainerStats();
        checkContainerAlerts();
        return containers;
    } catch (error) {
        console.error('Erro ao carregar contentores:', error);
        showNotification('Erro ao carregar contentores', 'error');
        return [];
    }
}

async function importExcelData() {
    try {
        showNotification('A importar dados do Excel...', 'info');
        
        const response = await fetch('/api/containers/import-excel', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification(`Importação concluída: ${result.processed} contentores processados`, 'success');
            await loadContainers(); // Recarregar dados
        } else {
            showNotification(result.error || 'Erro ao importar dados', 'error');
        }
    } catch (error) {
        console.error('Erro ao importar Excel:', error);
        showNotification('Erro ao importar dados do Excel', 'error');
    }
}

function renderContainers() {
    const tableBody = document.getElementById('containersTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    containers.forEach(container => {
        const row = document.createElement('tr');
        row.onclick = () => showContainerDetails(container);
        // Data attributes for filtering
        const maritime = isMaritime(container);
        row.dataset.type = maritime ? 'maritimo' : 'aereo';
        const typeText = container.cargo_type || (maritime ? 'Contentor Marítimo' : 'Expedição Aérea');
        
        const statusText = container.transit_status || '';
        const statusClass = normalizeText(statusText).includes('transito') || normalizeText(statusText).includes('trânsito') ? 'transito' : 'estimativa';
        const cargoTypeClass = maritime ? 'maritimo' : 'aereo';
        
        // Status de receção
        const isReceived = container.received === 1 || container.received === true;
        const receptionStatus = isReceived ? 
            '<span class="status-badge status-received">✓ Recebido</span>' : 
            '<span class="status-badge status-pending">⏳ Pendente</span>';
        
        // Adicionar classe à linha se estiver recebido
        if (isReceived) {
            row.classList.add('container-received');
        }
        
        row.innerHTML = `
            <td>${container.country_origin || '-'}</td>
            <td>${container.supplier || '-'}</td>
            <td><span class="container-type ${cargoTypeClass}">${typeText}</span></td>
            <td>${container.client || '-'}</td>
            <td>${container.container_ref || '-'}</td>
            <td>${container.container_size || '-'}</td>
            <td>${container.volumes || 0}</td>
            <td><span class="container-status ${statusClass}">${container.transit_status || '-'}</span></td>
            <td>${receptionStatus}</td>
            <td>${formatDate(container.departure_date)}</td>
            <td>${formatDate(container.arrival_date)}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

function updateContainerStats() {
    const totalContainers = document.getElementById('totalContainers');
    const totalExpeditions = document.getElementById('totalAirExpeditions');
    const transitContainers = document.getElementById('transitContainers');
    const weekContainers = document.getElementById('weekContainers');
    
    if (!totalContainers) return;
    
    // Separar contentores marítimos das expedições aéreas
    const maritimeContainers = containers.filter(c => isMaritime(c));
    const airExpeditions = containers.filter(c => !isMaritime(c));
    
    const transit = containers.filter(c => 
        c.transit_status && c.transit_status.toLowerCase().includes('trânsito')
    ).length;
    
    // Contentores da semana atual
    const today = new Date();
    const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
    const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    
    const thisWeek = containers.filter(c => {
        if (!c.arrival_date) return false;
        const arrivalDate = new Date(c.arrival_date);
        return arrivalDate >= weekStart && arrivalDate <= weekEnd;
    }).length;
    
    totalContainers.textContent = maritimeContainers.length;
    if (totalExpeditions) totalExpeditions.textContent = airExpeditions.length;
    transitContainers.textContent = transit;
    weekContainers.textContent = thisWeek;
}

async function checkContainerAlerts() {
    try {
        const response = await fetch('/api/containers/alerts');
        const allAlerts = await response.json();
        // Filtrar apenas contentores marítimos para alertas
        const alerts = allAlerts.filter(c => isMaritime(c));
        
        console.log('Alertas de contentores marítimos encontrados:', alerts.length);
        
        const alertsSection = document.getElementById('containerAlertsSection');
        const alertsList = document.getElementById('containerAlertsList');
        
        if (!alertsSection || !alertsList) {
            console.error('Elementos de alertas não encontrados no DOM');
            return;
        }
        
        if (alerts.length > 0) {
            console.log('Mostrando', alerts.length, 'alertas de contentores marítimos no dashboard');
            
            // Mostrar seção de alertas (sempre visível quando há alertas)
            alertsSection.style.display = 'block';
            alertsSection.classList.remove('manually-hidden');
            alertsList.innerHTML = '';
            
            // Agrupar contentores pela referência
            const groupedAlerts = {};
            alerts.forEach(container => {
                const ref = container.container_ref || 'N/A';
                if (!groupedAlerts[ref]) {
                    groupedAlerts[ref] = [];
                }
                groupedAlerts[ref].push(container);
            });
            
            // Renderizar alertas agrupados
            Object.entries(groupedAlerts).forEach(([ref, containersGroup]) => {
                const alertDiv = document.createElement('div');
                alertDiv.className = 'container-alert';
                
                // Se houver múltiplos contentores com a mesma referência
                if (containersGroup.length > 1) {
                    // Encontrar a data de chegada mais próxima
                    const earliestContainer = containersGroup.reduce((earliest, current) => {
                        const currentDate = new Date(current.arrival_date);
                        const earliestDate = new Date(earliest.arrival_date);
                        return currentDate < earliestDate ? current : earliest;
                    });
                    
                    const arrivalDate = new Date(earliestContainer.arrival_date);
                    const today = new Date();
                    const daysUntil = Math.ceil((arrivalDate - today) / (1000 * 60 * 60 * 24));
                    
                    // Definir classe de prioridade baseada nos dias
                    let priorityClass = '';
                    if (daysUntil <= 2) {
                        priorityClass = 'alert-urgent';
                    } else if (daysUntil <= 5) {
                        priorityClass = 'alert-warning';
                    } else {
                        priorityClass = 'alert-normal';
                    }
                    
                    alertDiv.classList.add(priorityClass);
                    
                    // Listar todos os fornecedores e clientes
                    const suppliers = [...new Set(containersGroup.map(c => c.supplier))].join(', ');
                    const clients = [...new Set(containersGroup.map(c => c.client))].join(', ');
                    const uniqueClientsCount = new Set(containersGroup.map(c => c.client)).size;
                    const contents = [...new Set(containersGroup.map(c => c.content).filter(Boolean))];
                    
                    alertDiv.innerHTML = `
                        <h4>${suppliers} → ${clients}</h4>
                        <p><strong>Referência:</strong> ${ref} <span style="color: #fbbf24; font-weight: 600;">(${uniqueClientsCount} cliente${uniqueClientsCount > 1 ? 's' : ''})</span></p>
                        ${contents.length > 0 ? `<p><strong>Conteúdo:</strong> ${contents.join(', ')}</p>` : ''}
                        <p class="alert-date">Chegada mais próxima: ${formatDate(earliestContainer.arrival_date)} (${daysUntil} dias)</p>
                    `;
                    
                    // Ao clicar, mostrar detalhes do primeiro contentor ou lista
                    alertDiv.onclick = () => showContainerDetails(earliestContainer);
                    
                } else {
                    // Contentor único
                    const container = containersGroup[0];
                    const arrivalDate = new Date(container.arrival_date);
                    const today = new Date();
                    const daysUntil = Math.ceil((arrivalDate - today) / (1000 * 60 * 60 * 24));
                    
                    // Definir classe de prioridade baseada nos dias
                    let priorityClass = '';
                    if (daysUntil <= 2) {
                        priorityClass = 'alert-urgent';
                    } else if (daysUntil <= 5) {
                        priorityClass = 'alert-warning';
                    } else {
                        priorityClass = 'alert-normal';
                    }
                    
                    alertDiv.classList.add(priorityClass);
                    
                    alertDiv.innerHTML = `
                        <h4>${container.supplier} → ${container.client}</h4>
                        <p><strong>Referência:</strong> ${container.container_ref || 'N/A'}</p>
                        <p><strong>Conteúdo:</strong> ${container.content || 'N/A'}</p>
                        <p class="alert-date">Chegada: ${formatDate(container.arrival_date)} (${daysUntil} dias)</p>
                    `;
                    
                    alertDiv.onclick = () => showContainerDetails(container);
                }
                
                alertsList.appendChild(alertDiv);
            });
            
            // Configurar altura máxima para animação de colapso
            setTimeout(() => {
                if (!alertsList.classList.contains('collapsed')) {
                    alertsList.style.maxHeight = alertsList.scrollHeight + 'px';
                }
            }, 100);
        } else {
            console.log('Nenhum alerta de contentor marítimo - ocultando seção');
            alertsSection.style.display = 'none';
            alertsSection.classList.remove('manually-hidden');
        }
    } catch (error) {
        console.error('Erro ao verificar alertas de contentores:', error);
    }
}

// Função para colapsar/expandir apenas o conteúdo dos alertas
function toggleAlertsCollapse() {
    const alertsList = document.getElementById('containerAlertsList');
    const collapseBtn = document.getElementById('collapseAlertsBtn');
    
    if (!alertsList || !collapseBtn) return;
    
    if (alertsList.classList.contains('collapsed')) {
        // Expandir
        alertsList.classList.remove('collapsed');
        collapseBtn.classList.remove('rotated');
        // Definir altura máxima baseada no conteúdo real
        alertsList.style.maxHeight = alertsList.scrollHeight + 'px';
    } else {
        // Colapsar
        // Primeiro definir a altura atual explicitamente
        alertsList.style.maxHeight = alertsList.scrollHeight + 'px';
        // Forçar reflow
        alertsList.offsetHeight;
        // Depois colapsar
        alertsList.classList.add('collapsed');
        collapseBtn.classList.add('rotated');
    }
}

// Função para toggle da seção de reuniões
function toggleMeetingsSection() {
    const meetingsSection = document.querySelector('.recent-section');
    const expandIcon = document.getElementById('meetingsExpandIcon');
    const meetingsCount = document.getElementById('meetingsToday');
    const meetingsCard = document.getElementById('meetingsTodayCard');
    
    if (!meetingsSection || !expandIcon || !meetingsCount || !meetingsCard) return;
    
    // Só permitir toggle se houver reuniões
    const count = parseInt(meetingsCount.textContent);
    if (count === 0) {
        // Remover estilo clicável quando não há reuniões
        meetingsCard.style.cursor = 'default';
        return;
    }
    
    // Garantir que o card é clicável quando há reuniões
    meetingsCard.style.cursor = 'pointer';
    
    if (meetingsSection.style.display === 'none' || meetingsSection.classList.contains('manually-hidden')) {
        // Mostrar seção de reuniões
        meetingsSection.style.display = 'block';
        meetingsSection.classList.remove('manually-hidden');
        expandIcon.parentElement.classList.add('rotated');
        
        // Carregar reuniões próximas (usar a função existente)
        renderMeetings();
    } else {
        // Esconder seção de reuniões
        meetingsSection.style.display = 'none';
        meetingsSection.classList.add('manually-hidden');
        expandIcon.parentElement.classList.remove('rotated');
    }
}

// Função para toggle da seção de tarefas
function toggleTasksSection() {
    const tasksSection = document.getElementById('tasksAlertsSection');
    const expandIcon = document.getElementById('tasksExpandIcon');
    const tasksCount = document.getElementById('pendingTasks');
    const tasksCard = document.getElementById('pendingTasksCard');
    
    if (!tasksSection || !expandIcon || !tasksCount || !tasksCard) return;
    
    // Só permitir toggle se houver tarefas
    const count = parseInt(tasksCount.textContent);
    if (count === 0) {
        // Remover estilo clicável quando não há tarefas
        tasksCard.style.cursor = 'default';
        return;
    }
    
    // Garantir que o card é clicável quando há tarefas
    tasksCard.style.cursor = 'pointer';
    
    if (tasksSection.style.display === 'none' || tasksSection.classList.contains('manually-hidden')) {
        // Mostrar seção de tarefas
        tasksSection.style.display = 'block';
        tasksSection.classList.remove('manually-hidden');
        expandIcon.parentElement.classList.add('rotated');
        
        // Garantir que o conteúdo não esteja colapsado
        const tasksList = document.getElementById('tasksAlertsList');
        if (tasksList && tasksList.classList.contains('collapsed')) {
            tasksList.classList.remove('collapsed');
            setTimeout(() => {
                tasksList.style.maxHeight = tasksList.scrollHeight + 'px';
            }, 100);
        }
        
        // Carregar tarefas pendentes
        loadPendingTasks();
    } else {
        // Esconder seção de tarefas
        tasksSection.style.display = 'none';
        tasksSection.classList.add('manually-hidden');
        expandIcon.parentElement.classList.remove('rotated');
    }
}

// Função para colapsar/expandir apenas o conteúdo das reuniões
function toggleMeetingsCollapse() {
    const meetingsList = document.getElementById('meetingsAlertsList');
    const collapseBtn = document.getElementById('collapseMeetingsBtn');
    
    if (!meetingsList || !collapseBtn) return;
    
    if (meetingsList.classList.contains('collapsed')) {
        // Expandir
        meetingsList.classList.remove('collapsed');
        collapseBtn.classList.remove('rotated');
        meetingsList.style.maxHeight = meetingsList.scrollHeight + 'px';
    } else {
        // Colapsar
        meetingsList.style.maxHeight = meetingsList.scrollHeight + 'px';
        meetingsList.offsetHeight;
        meetingsList.classList.add('collapsed');
        collapseBtn.classList.add('rotated');
    }
}

// Função para colapsar/expandir apenas o conteúdo das tarefas
function toggleTasksCollapse() {
    const tasksList = document.getElementById('tasksAlertsList');
    const collapseBtn = document.getElementById('collapseTasksBtn');
    
    if (!tasksList || !collapseBtn) return;
    
    if (tasksList.classList.contains('collapsed')) {
        // Expandir
        tasksList.classList.remove('collapsed');
        collapseBtn.classList.remove('rotated');
        tasksList.style.maxHeight = tasksList.scrollHeight + 'px';
    } else {
        // Colapsar
        tasksList.style.maxHeight = tasksList.scrollHeight + 'px';
        tasksList.offsetHeight;
        tasksList.classList.add('collapsed');
        collapseBtn.classList.add('rotated');
    }
}

// Função para toggle da seção de viaturas reservadas
function toggleReservedVehiclesSection() {
    const reservedSection = document.getElementById('reservedVehiclesSection');
    const expandIcon = document.getElementById('reservedVehiclesExpandIcon');
    const reservedCount = document.getElementById('reservedVehicles');
    const reservedCard = document.getElementById('reservedVehiclesCard');
    
    if (!reservedSection || !expandIcon || !reservedCount || !reservedCard) return;
    
    // Só permitir toggle se houver viaturas reservadas
    const count = parseInt(reservedCount.textContent);
    if (count === 0) {
        // Remover estilo clicável quando não há reservas
        reservedCard.style.cursor = 'default';
        return;
    }
    
    // Garantir que o card é clicável quando há reservas
    reservedCard.style.cursor = 'pointer';
    
    if (reservedSection.style.display === 'none' || reservedSection.classList.contains('manually-hidden')) {
        // Mostrar seção de viaturas reservadas
        reservedSection.style.display = 'block';
        reservedSection.classList.remove('manually-hidden');
        expandIcon.parentElement.classList.add('rotated');
        
        // Garantir que o conteúdo não esteja colapsado
        const reservedList = document.getElementById('reservedVehiclesList');
        if (reservedList && reservedList.classList.contains('collapsed')) {
            reservedList.classList.remove('collapsed');
            setTimeout(() => {
                reservedList.style.maxHeight = reservedList.scrollHeight + 'px';
            }, 100);
        }
        
        // Carregar viaturas reservadas
        loadReservedVehicles();
    } else {
        // Esconder seção de viaturas reservadas
        reservedSection.style.display = 'none';
        reservedSection.classList.add('manually-hidden');
        expandIcon.parentElement.classList.remove('rotated');
    }
}

// Função para colapsar/expandir apenas o conteúdo das viaturas reservadas
function toggleReservedVehiclesCollapse() {
    const reservedList = document.getElementById('reservedVehiclesList');
    const collapseBtn = document.getElementById('collapseReservedVehiclesBtn');
    
    if (!reservedList || !collapseBtn) return;
    
    if (reservedList.classList.contains('collapsed')) {
        // Expandir
        reservedList.classList.remove('collapsed');
        collapseBtn.classList.remove('rotated');
        reservedList.style.maxHeight = reservedList.scrollHeight + 'px';
    } else {
        // Colapsar
        reservedList.style.maxHeight = reservedList.scrollHeight + 'px';
        reservedList.offsetHeight;
        reservedList.classList.add('collapsed');
        collapseBtn.classList.add('rotated');
    }
}

function showContainerDetails(container) {
    const modal = document.getElementById('containerModal');
    const detailsDiv = document.getElementById('containerDetails');
    
    if (!modal || !detailsDiv) return;

    const isReceived = container.received === 1 || container.received === true;
    const receivedDate = container.received_date;
    
    // Buscar todos os contentores com a mesma referência
    const sameRefContainers = containers.filter(c => 
        c.container_ref === container.container_ref && container.container_ref
    );
    
    // Obter todos os clientes únicos
    const allClients = [...new Set(sameRefContainers.map(c => c.client).filter(Boolean))];
    const clientsList = allClients.length > 0 ? allClients.join(', ') : 'N/A';
    
    // Obter todas as encomendas internas únicas
    const allOrders = [...new Set(sameRefContainers.map(c => c.internal_order).filter(Boolean))];
    const ordersList = allOrders.length > 0 ? allOrders.join(', ') : 'N/A';
    
    // Calcular total de volumes
    const totalVolumes = sameRefContainers.reduce((sum, c) => sum + (parseInt(c.volumes) || 0), 0);
    
    // Obter todo o conteúdo único
    const allContent = [...new Set(sameRefContainers.map(c => c.content).filter(Boolean))];
    const contentList = allContent.length > 0 ? allContent.join(', ') : 'N/A';
    
    detailsDiv.innerHTML = `
        <div class="detail-group">
            <h4>Informações Básicas</h4>
            <div class="detail-item">
                <span class="detail-label">País de Origem:</span>
                <span class="detail-value">${container.country_origin || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Fornecedor:</span>
                <span class="detail-value">${container.supplier || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Cliente${allClients.length > 1 ? 's' : ''}:</span>
                <span class="detail-value">${clientsList}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Encomenda${allOrders.length > 1 ? 's' : ''} Interna${allOrders.length > 1 ? 's' : ''}:</span>
                <span class="detail-value">${ordersList}</span>
            </div>
            ${sameRefContainers.length > 1 ? `
            <div class="detail-item">
                <span class="detail-label">Contentores Agrupados:</span>
                <span class="detail-value" style="color: #fbbf24; font-weight: 600;">${sameRefContainers.length}</span>
            </div>
            ` : ''}
        </div>
        
        <div class="detail-group">
            <h4>Detalhes da Carga</h4>
            <div class="detail-item">
                <span class="detail-label">Tipo de Carga:</span>
                <span class="detail-value">${container.cargo_type || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Referência:</span>
                <span class="detail-value">${container.container_ref || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Tamanho:</span>
                <span class="detail-value">${container.container_size || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Total de Volumes:</span>
                <span class="detail-value" style="font-weight: 600;">${totalVolumes}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Conteúdo Completo:</span>
                <span class="detail-value">${contentList}</span>
            </div>
        </div>
        
        <div class="detail-group">
            <h4>Cronograma</h4>
            <div class="detail-item">
                <span class="detail-label">Status:</span>
                <span class="detail-value">${container.transit_status || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Data de Saída:</span>
                <span class="detail-value">${formatDate(container.departure_date)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Data de Chegada:</span>
                <span class="detail-value">${formatDate(container.arrival_date)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Semana:</span>
                <span class="detail-value">${container.arrival_week || 'N/A'}</span>
            </div>
        </div>
        
        <div class="detail-group">
            <h4>Status de Receção</h4>
            <div class="detail-item">
                <span class="detail-label">Status:</span>
                <span class="detail-value">
                    <span class="status-badge ${isReceived ? 'status-received' : 'status-pending'}">
                        ${isReceived ? '✓ Recebido' : '⏳ Pendente'}
                    </span>
                </span>
            </div>
            ${isReceived && receivedDate ? `
            <div class="detail-item">
                <span class="detail-label">Data de Receção:</span>
                <span class="detail-value">${formatDateTime(receivedDate)}</span>
            </div>
            ` : ''}
        </div>
        
        <div class="modal-actions">
            ${!isReceived ? `
                <button class="btn btn-success" onclick="markContainerAsReceived('${container.id}')">
                    <i class="fas fa-check"></i> Marcar como Recebido
                </button>
            ` : `
                <button class="btn btn-warning" onclick="markContainerAsUnreceived('${container.id}')">
                    <i class="fas fa-undo"></i> Marcar como Não Recebido
                </button>
            `}
        </div>
    `;
    
    modal.style.display = 'block';
}

function formatDateTime(dateString) {
    if (!dateString || dateString === '') return 'N/A';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        
        return date.toLocaleDateString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'N/A';
    }
}

async function markContainerAsReceived(containerId) {
    try {
        const response = await fetch(`/api/containers/${containerId}/received`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Contentor marcado como recebido com sucesso!', 'success');
            
            // Fechar modal
            const modal = document.getElementById('containerModal');
            if (modal) modal.style.display = 'none';
            
            // Recarregar dados
            await loadContainers();
            
        } else {
            showNotification(result.error || 'Erro ao marcar contentor como recebido', 'error');
        }
    } catch (error) {
        console.error('Erro ao marcar contentor como recebido:', error);
        showNotification('Erro ao marcar contentor como recebido', 'error');
    }
}

async function markContainerAsUnreceived(containerId) {
    try {
        const response = await fetch(`/api/containers/${containerId}/unreceived`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Contentor marcado como não recebido com sucesso!', 'success');
            
            // Fechar modal
            const modal = document.getElementById('containerModal');
            if (modal) modal.style.display = 'none';
            
            // Recarregar dados
            await loadContainers();
            
        } else {
            showNotification(result.error || 'Erro ao marcar contentor como não recebido', 'error');
        }
    } catch (error) {
        console.error('Erro ao marcar contentor como não recebido:', error);
        showNotification('Erro ao marcar contentor como não recebido', 'error');
    }
}

function formatDate(dateString) {
    if (!dateString || dateString === '' || dateString === 'Dia Prev.') return 'N/A';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        
        return date.toLocaleDateString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        return 'N/A';
    }
}

// Marcar expedição como concluída
async function markExpeditionAsCompleted(expeditionId) {
    try {
        if (!confirm('Tem a certeza que deseja marcar esta expedição como concluída?')) {
            return;
        }

        const response = await fetch(`/api/expeditions/${expeditionId}/completed`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Expedição marcada como concluída com sucesso!', 'success');
            
            // Recarregar dados de expedições
            await loadExpeditions();
            
            // Recarregar alertas de expedições se estiver no dashboard
            const currentPage = document.querySelector('.page.active');
            if (currentPage && currentPage.id === 'dashboard') {
                await checkExpeditionAlerts();
            }
            
        } else {
            showNotification(result.error || 'Erro ao marcar expedição como concluída', 'error');
        }
    } catch (error) {
        console.error('Erro ao marcar expedição como concluída:', error);
        showNotification('Erro ao marcar expedição como concluída', 'error');
    }
}

// Marcar expedição como não concluída
async function markExpeditionAsUncompleted(expeditionId) {
    try {
        const response = await fetch(`/api/expeditions/${expeditionId}/uncompleted`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Expedição marcada como não concluída com sucesso!', 'success');
            
            // Recarregar dados de expedições
            await loadExpeditions();
            
            // Recarregar alertas de expedições se estiver no dashboard
            const currentPage = document.querySelector('.page.active');
            if (currentPage && currentPage.id === 'dashboard') {
                await checkExpeditionAlerts();
            }
            
        } else {
            showNotification(result.error || 'Erro ao marcar expedição como não concluída', 'error');
        }
    } catch (error) {
        console.error('Erro ao marcar expedição como não concluída:', error);
        showNotification('Erro ao marcar expedição como não concluída', 'error');
    }
}

// Event Listeners para Contentores
if (importExcelBtn) {
    importExcelBtn.addEventListener('click', importExcelData);
}

if (containerModal) {
    const closeBtn = document.getElementById('closeContainerModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            containerModal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === containerModal) {
            containerModal.style.display = 'none';
        }
    });
}

// EXPEDIÇÕES
async function loadExpeditions() {
    try {
        console.log('Carregando expedições...');
        const response = await fetch('/api/expeditions');
        expeditions = await response.json();
        console.log('Expedições carregadas:', expeditions.length);
        renderExpeditions();
        updateExpeditionStats();
        await checkExpeditionAlerts();
        return expeditions;
    } catch (error) {
        console.error('Erro ao carregar expedições:', error);
        showNotification('Erro ao carregar expedições', 'error');
    }
}

async function importExpeditionsExcelData() {
    try {
        const response = await fetch('/api/expeditions/import-excel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`${result.message}: ${result.processed} expedições processadas`, 'success');
            await loadExpeditions(); // Recarregar dados
        } else {
            const error = await response.json();
            showNotification(error.error, 'error');
        }
    } catch (error) {
        console.error('Erro ao importar Excel de expedições:', error);
        showNotification('Erro ao importar ficheiro Excel de expedições', 'error');
    }
}

function renderExpeditions() {
    console.log('Renderizando expedições...');
    const tableBody = document.getElementById('expeditionsTableBody');
    if (!tableBody) {
        console.error('Elemento expeditionsTableBody não encontrado!');
        return;
    }
    
    console.log('Número de expedições a renderizar:', expeditions.length);
    tableBody.innerHTML = '';
    
    expeditions.forEach(expedition => {
        const row = document.createElement('tr');
        
        // Definir classe baseada na prioridade
        let priorityClass = '';
        const priority = expedition.priority?.toLowerCase();
        if (priority?.includes('alta') || priority?.includes('urgente')) {
            priorityClass = 'priority-high';
        } else if (priority?.includes('média') || priority?.includes('medium')) {
            priorityClass = 'priority-medium';
        } else if (priority?.includes('baixa') || priority?.includes('low')) {
            priorityClass = 'priority-low';
        }
        
        row.className = priorityClass;
        
        // Definir classe baseada no status ou no campo completed
        let statusClass = '';
        const status = expedition.status?.toLowerCase();
        const isCompleted = expedition.completed === 1 || expedition.completed === true;
        
        if (isCompleted) {
            statusClass = 'status-completed';
            row.classList.add('expedition-completed');
        } else if (status?.includes('concluída') || status?.includes('entregue')) {
            statusClass = 'status-completed';
        } else if (status?.includes('em curso') || status?.includes('expedida')) {
            statusClass = 'status-in-progress';
        } else if (status?.includes('pendente') || status?.includes('aguarda')) {
            statusClass = 'status-pending';
        }
        
        // Status de conclusão
        const completionStatus = isCompleted ? 
            '<span class="status-badge status-completed">✓ Concluída</span>' : 
            '<span class="status-badge status-pending">⏳ Pendente</span>';
        
        row.innerHTML = `
            <td>${expedition.expedition_week || 'N/A'}</td>
            <td><span class="priority-badge priority-${priority || 'none'}">${expedition.priority || 'N/A'}</span></td>
            <td>${expedition.expedition_day_week || 'N/A'}</td>
            <td>${formatDate(expedition.expedition_date)}</td>
            <td>${expedition.client || 'N/A'}</td>
            <td>${expedition.client_manager || 'N/A'}</td>
            <td>${expedition.content || 'N/A'}</td>
            <td>${expedition.quantity || 'N/A'}</td>
            <td>${expedition.current_location || 'N/A'}</td>
            <td>${expedition.volume_type || 'N/A'}</td>
            <td>${expedition.delivery_location || 'N/A'}</td>
            <td><span class="status-badge ${statusClass}">${expedition.status || 'N/A'}</span></td>
            <td>${completionStatus}</td>
            <td>
                ${!isCompleted ? `
                    <button class="btn btn-sm btn-success" onclick="markExpeditionAsCompleted('${expedition.id}')" title="Marcar como concluída">
                        <i class="fas fa-check"></i>
                    </button>
                ` : `
                    <button class="btn btn-sm btn-warning" onclick="markExpeditionAsUncompleted('${expedition.id}')" title="Marcar como não concluída">
                        <i class="fas fa-undo"></i>
                    </button>
                `}
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function updateExpeditionStats() {
    const totalExpeditionsEl = document.getElementById('totalExpeditions');
    const urgentExpeditionsEl = document.getElementById('urgentExpeditions');
    const upcomingExpeditionsEl = document.getElementById('upcomingExpeditions');
    const completedExpeditionsEl = document.getElementById('completedExpeditions');
    
    if (!totalExpeditionsEl) return;
    
    const total = expeditions.length;
    
    // Expedições de alta prioridade
    const urgent = expeditions.filter(e => {
        const priority = e.priority?.toLowerCase();
        return priority?.includes('alta') || priority?.includes('urgente');
    }).length;
    
    // Expedições nos próximos 5 dias úteis
    const today = new Date();
    const next5WorkDays = new Date();
    let daysAdded = 0;
    let currentDate = new Date(today);
    
    while (daysAdded < 5) {
        currentDate.setDate(currentDate.getDate() + 1);
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
            daysAdded++;
        }
    }
    
    const upcoming = expeditions.filter(e => {
        if (!e.expedition_date) return false;
        const expeditionDate = new Date(e.expedition_date);
        return expeditionDate >= today && expeditionDate <= currentDate;
    }).length;
    
    // Expedições concluídas
    const completed = expeditions.filter(e => {
        const status = e.status?.toLowerCase();
        return status?.includes('concluída') || status?.includes('entregue');
    }).length;
    
    totalExpeditionsEl.textContent = total;
    urgentExpeditionsEl.textContent = urgent;
    upcomingExpeditionsEl.textContent = upcoming;
    completedExpeditionsEl.textContent = completed;
}

async function checkExpeditionAlerts() {
    try {
        const response = await fetch('/api/expeditions/alerts');
        const alerts = await response.json();
        
        const alertsSection = document.getElementById('expeditionAlertsSection');
        const alertsList = document.getElementById('expeditionAlertsList');
        
        if (!alertsSection || !alertsList) return;
        
        if (alerts.length > 0) {
            alertsSection.style.display = 'block';
            alertsList.innerHTML = '';
            
            alerts.forEach(expedition => {
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert-item expedition-alert';
                
                const expeditionDate = new Date(expedition.expedition_date);
                const today = new Date();
                const daysUntil = Math.ceil((expeditionDate - today) / (1000 * 60 * 60 * 24));
                
                // Definir classe de prioridade baseada nos dias e prioridade da expedição
                let priorityClass = '';
                const priority = expedition.priority?.toLowerCase();
                
                if (priority?.includes('alta') || priority?.includes('urgente') || daysUntil <= 1) {
                    priorityClass = 'alert-urgent';
                } else if (daysUntil <= 3) {
                    priorityClass = 'alert-warning';
                } else {
                    priorityClass = 'alert-normal';
                }
                
                alertDiv.classList.add(priorityClass);
                
                alertDiv.innerHTML = `
                    <h4>${expedition.client} - ${expedition.content}</h4>
                    <p><strong>Prioridade:</strong> ${expedition.priority || 'N/A'}</p>
                    <p><strong>Quantidade:</strong> ${expedition.quantity || 'N/A'}</p>
                    <p><strong>Local Atual:</strong> ${expedition.current_location || 'N/A'}</p>
                    <p><strong>Entrega:</strong> ${expedition.delivery_location || 'N/A'}</p>
                    <p class="alert-date">Expedição: ${formatDate(expedition.expedition_date)} (${daysUntil} dias)</p>
                    <div class="alert-actions" style="margin-top: 10px;">
                        <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); markExpeditionAsCompleted('${expedition.id}')" title="Marcar como concluída">
                            <i class="fas fa-check"></i> Concluída
                        </button>
                    </div>
                `;
                
                alertsList.appendChild(alertDiv);
            });
            
            // Configurar altura máxima para animação de colapso
            setTimeout(() => {
                if (!alertsList.classList.contains('collapsed')) {
                    alertsList.style.maxHeight = alertsList.scrollHeight + 'px';
                }
            }, 100);
        } else {
            alertsSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Erro ao verificar alertas de expedições:', error);
    }
}

// Função para alternar a visibilidade da seção de alertas de expedições
function toggleExpeditionsSection() {
    const alertsSection = document.getElementById('expeditionAlertsSection');
    const collapseBtn = document.getElementById('collapseExpeditionsBtn');
    
    if (!alertsSection || !collapseBtn) return;
    
    if (alertsSection.style.display === 'none') {
        alertsSection.style.display = 'block';
        collapseBtn.classList.remove('rotated');
    } else {
        alertsSection.style.display = 'none';
        collapseBtn.classList.add('rotated');
    }
}

// Função para colapsar/expandir apenas o conteúdo dos alertas de expedições
function toggleExpeditionsCollapse() {
    const alertsList = document.getElementById('expeditionAlertsList');
    const collapseBtn = document.getElementById('collapseExpeditionsBtn');
    
    if (!alertsList || !collapseBtn) return;
    
    if (alertsList.classList.contains('collapsed')) {
        // Expandir
        alertsList.classList.remove('collapsed');
        alertsList.style.maxHeight = alertsList.scrollHeight + 'px';
        collapseBtn.classList.remove('rotated');
    } else {
        // Colapsar
        alertsList.style.maxHeight = alertsList.scrollHeight + 'px';
        alertsList.offsetHeight;
        alertsList.classList.add('collapsed');
        collapseBtn.classList.add('rotated');
    }
}

// Event Listeners para Expedições
const importExpeditionsExcelBtn = document.getElementById('importExpeditionsExcelBtn');
if (importExpeditionsExcelBtn) {
    importExpeditionsExcelBtn.addEventListener('click', importExpeditionsExcelData);
}

// === FUNCIONALIDADES DA FROTA ===

// Carregar dados da frota
async function loadFleetData() {
    try {
        const [vehiclesRes, reservationsRes, maintenanceRes] = await Promise.all([
            fetch('/api/vehicles'),
            fetch('/api/vehicle-reservations'),
            fetch('/api/vehicle-maintenance')
        ]);

        vehicles = await vehiclesRes.json();
        reservations = await reservationsRes.json();
        maintenance = await maintenanceRes.json();

        updateFleetDisplay();
        updateFleetStats();
        updateFleetPageStats(); // Nova função para estatísticas na página da frota
        loadMaintenanceAlerts();
    } catch (error) {
        console.error('Erro ao carregar dados da frota:', error);
        showNotification('Erro ao carregar dados da frota', 'error');
    }
}

// Atualizar estatísticas na página da frota
function updateFleetPageStats() {
    if (!vehicles || vehicles.length === 0) return;
    
    const totalVehicles = vehicles.length;
    const availableVehicles = vehicles.filter(v => v.status === 'available').length;
    const reservedVehicles = vehicles.filter(v => v.status === 'reserved').length;
    const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length;
    
    const totalEl = document.getElementById('totalVehicles');
    const availableEl = document.getElementById('availableVehicles');
    const reservedEl = document.getElementById('reservedVehicles');
    const maintenanceEl = document.getElementById('maintenanceVehicles');
    
    if (totalEl) totalEl.textContent = totalVehicles;
    if (availableEl) availableEl.textContent = availableVehicles;
    if (reservedEl) reservedEl.textContent = reservedVehicles;
    if (maintenanceEl) maintenanceEl.textContent = maintenanceVehicles;
}

// Atualizar estatísticas da frota no dashboard
async function updateFleetStats() {
    try {
        const response = await fetch('/api/fleet-stats');
        const stats = await response.json();

        const availableVehiclesEl = document.getElementById('availableVehicles');
        if (availableVehiclesEl) {
            availableVehiclesEl.textContent = stats.availableVehicles || 0;
        }
    } catch (error) {
        console.error('Erro ao carregar estatísticas da frota:', error);
    }
}

// Carregar alertas de manutenção
async function loadMaintenanceAlerts() {
    try {
        const response = await fetch('/api/maintenance-alerts');
        const alerts = await response.json();

        const alertsCountEl = document.getElementById('maintenanceAlerts');
        const alertsListEl = document.getElementById('maintenanceAlertsList');

        if (alertsCountEl) {
            alertsCountEl.textContent = alerts.length;
        }

        if (alertsListEl) {
            if (alerts.length === 0) {
                alertsListEl.innerHTML = '<p>Nenhum alerta de manutenção.</p>';
            } else {
                alertsListEl.innerHTML = alerts.map(alert => `
                    <div class="maintenance-alert-item">
                        <div class="maintenance-alert-info">
                            <div class="maintenance-alert-vehicle">
                                ${alert.brand} ${alert.model} (${alert.license_plate})
                            </div>
                            <div class="maintenance-alert-details">
                                ${alert.maintenance_type} - ${alert.description || 'Sem descrição'}
                            </div>
                        </div>
                        <div class="maintenance-alert-date">
                            ${new Date(alert.scheduled_date).toLocaleDateString('pt-PT')}
                        </div>
                    </div>
                `).join('');
            }
        }

        // Configurar evento de clique para mostrar/ocultar alertas
        const alertCard = document.getElementById('maintenanceAlertsCard');
        const alertSection = document.getElementById('maintenanceAlertsSection');
        const collapseBtn = document.getElementById('collapseMaintenanceBtn');

        if (alertCard && alertSection) {
            alertCard.addEventListener('click', () => {
                const isVisible = alertSection.style.display !== 'none';
                alertSection.style.display = isVisible ? 'none' : 'block';
            });
        }

        if (collapseBtn && alertSection) {
            collapseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                alertSection.style.display = 'none';
            });
        }
    } catch (error) {
        console.error('Erro ao carregar alertas de manutenção:', error);
    }
}

// Carregar alertas de viaturas reservadas
async function loadReservedVehiclesAlerts() {
    try {
        // Carregar reservas ativas
        const response = await fetch('/api/vehicle-reservations');
        const allReservations = await response.json();
        
        // Filtrar apenas reservas ativas/atuais
        const now = new Date();
        const today = now.toDateString();
        
        const activeReservations = allReservations.filter(reservation => {
            const startDate = new Date(reservation.start_date);
            const endDate = new Date(reservation.end_date);
            return now >= startDate && now <= endDate;
        });

        const reservedCountEl = document.getElementById('reservedVehicles');
        const reservedCard = document.getElementById('reservedVehiclesCard');

        if (reservedCountEl) {
            reservedCountEl.textContent = activeReservations.length;
        }

        // Atualizar estilo do card baseado no número de reservas
        if (reservedCard) {
            reservedCard.style.cursor = activeReservations.length > 0 ? 'pointer' : 'default';
            
            if (activeReservations.length > 0) {
                reservedCard.classList.add('has-alerts');
                reservedCard.title = `${activeReservations.length} viatura${activeReservations.length > 1 ? 's' : ''} reservada${activeReservations.length > 1 ? 's' : ''}`;
            } else {
                reservedCard.classList.remove('has-alerts');
                reservedCard.title = 'Nenhuma viatura reservada';
            }
        }
    } catch (error) {
        console.error('Erro ao carregar alertas de viaturas reservadas:', error);
    }
}

// Função para carregar viaturas reservadas na seção de alertas
async function loadReservedVehicles() {
    const reservedList = document.getElementById('reservedVehiclesList');
    if (!reservedList) return;
    
    try {
        const response = await fetch('/api/vehicle-reservations');
        const allReservations = await response.json();
        
        // Filtrar apenas reservas ativas/atuais
        const now = new Date();
        const activeReservations = allReservations.filter(reservation => {
            const startDate = new Date(reservation.start_date);
            const endDate = new Date(reservation.end_date);
            return now >= startDate && now <= endDate;
        });
        
        if (activeReservations.length === 0) {
            reservedList.innerHTML = '<p class="no-items">Nenhuma viatura reservada atualmente.</p>';
            return;
        }
        
        reservedList.innerHTML = activeReservations.map(reservation => {
            const startDate = new Date(reservation.start_date);
            const endDate = new Date(reservation.end_date);
            const startDateStr = startDate.toLocaleDateString('pt-PT');
            const endDateStr = endDate.toLocaleDateString('pt-PT');
            const startTimeStr = startDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
            const endTimeStr = endDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
            
            return `
                <div class="alert-item reservation-alert">
                    <div class="alert-icon">
                        <i class="fas fa-car text-warning"></i>
                    </div>
                    <div class="alert-content">
                        <h4>${reservation.brand} ${reservation.model}</h4>
                        <p><strong>Matrícula:</strong> ${reservation.license_plate}</p>
                        <p><strong>Reservado por:</strong> ${reservation.user_name}</p>
                        <p><strong>Propósito:</strong> ${reservation.purpose || 'Não especificado'}</p>
                        <p><i class="fas fa-calendar"></i> ${startDateStr} ${startTimeStr} - ${endDateStr} ${endTimeStr}</p>
                    </div>
                    <div class="alert-actions">
                        <button class="btn btn-sm btn-primary" onclick="editReservation('${reservation.id}')" title="Editar reserva">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="cancelReservation('${reservation.id}')" title="Cancelar reserva">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Erro ao carregar viaturas reservadas:', error);
        reservedList.innerHTML = '<p class="error-message">Erro ao carregar viaturas reservadas.</p>';
    }
}

// Atualizar display da frota
function updateFleetDisplay() {
    updateVehiclesGrid();
    updateReservationsTable();
    updateMaintenanceTable();
}

// Atualizar grid de viaturas
function updateVehiclesGrid() {
    const grid = document.getElementById('vehiclesGrid');
    if (!grid) return;

    if (vehicles.length === 0) {
        grid.innerHTML = '<p>Nenhuma viatura cadastrada.</p>';
        return;
    }

    grid.innerHTML = vehicles.map(vehicle => `
        <div class="vehicle-card">
            <div class="vehicle-header">
                <div class="vehicle-title-with-icon">
                    <i class="fas ${getVehicleIcon(vehicle.vehicle_type)}"></i>
                    <h3 class="vehicle-title">${vehicle.brand} ${vehicle.model}</h3>
                </div>
                <span class="vehicle-status ${vehicle.status}">${getStatusText(vehicle.status)}</span>
            </div>
            <div class="vehicle-info">
                <div class="vehicle-info-item">
                    <span class="vehicle-info-label">Matrícula:</span>
                    <span class="vehicle-info-value">${vehicle.license_plate}</span>
                </div>
                <div class="vehicle-info-item">
                    <span class="vehicle-info-label">Ano:</span>
                    <span class="vehicle-info-value">${vehicle.year || 'N/A'}</span>
                </div>
                <div class="vehicle-info-item">
                    <span class="vehicle-info-label">Tipo:</span>
                    <span class="vehicle-info-value">${getVehicleTypeText(vehicle.vehicle_type)}</span>
                </div>
                <div class="vehicle-info-item">
                    <span class="vehicle-info-label">Combustível:</span>
                    <span class="vehicle-info-value">${getFuelTypeText(vehicle.fuel_type)}</span>
                </div>
                <div class="vehicle-info-item">
                    <span class="vehicle-info-label">Quilómetros:</span>
                    <span class="vehicle-info-value">${vehicle.mileage || 0} km</span>
                </div>
            </div>
            <div class="vehicle-actions">
                <button class="btn btn-sm btn-primary" onclick="editVehicle('${vehicle.id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteVehicle('${vehicle.id}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `).join('');
}

// Atualizar tabela de reservas
function updateReservationsTable() {
    const tbody = document.getElementById('reservationsTableBody');
    if (!tbody) return;

    if (reservations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">Nenhuma reserva encontrada.</td></tr>';
        return;
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999); // Fim do dia atual para comparação

    tbody.innerHTML = reservations.map(reservation => {
        const endDate = new Date(reservation.end_date);
        
        // Verificar se a reserva deve ser automaticamente concluída
        const shouldAutoComplete = endDate < today && reservation.status === 'active';
        
        // Se deve ser auto-concluída, fazer isso em segundo plano
        if (shouldAutoComplete) {
            console.log(`Reserva expirada detectada: ${reservation.id} (fim: ${reservation.end_date})`);
            setTimeout(() => autoCompleteReservation(reservation.id), 100);
        }
        
        return `
        <tr>
            <td>${reservation.brand} ${reservation.model} (${reservation.license_plate})</td>
            <td>${reservation.user_name}</td>
            <td>${new Date(reservation.start_date).toLocaleDateString('pt-PT')}</td>
            <td>${new Date(reservation.end_date).toLocaleDateString('pt-PT')}</td>
            <td>${reservation.purpose || 'N/A'}</td>
            <td><span class="status-badge ${reservation.status}">${getStatusText(reservation.status)}</span></td>
            <td>
                ${reservation.status === 'active' ? `
                    <button class="btn btn-sm btn-success" onclick="completeReservation('${reservation.id}')" title="Concluir Reserva">
                        <i class="fas fa-check"></i>
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-primary" onclick="editReservation('${reservation.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteReservation('${reservation.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
    }).join('');
}

// Atualizar tabela de manutenções
function updateMaintenanceTable() {
    const tbody = document.getElementById('maintenanceTableBody');
    if (!tbody) return;

    if (maintenance.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">Nenhuma manutenção encontrada.</td></tr>';
        return;
    }

    tbody.innerHTML = maintenance.map(maint => `
        <tr>
            <td>${maint.brand} ${maint.model} (${maint.license_plate})</td>
            <td>${getMaintenanceTypeText(maint.maintenance_type)}</td>
            <td>${new Date(maint.scheduled_date).toLocaleDateString('pt-PT')}</td>
            <td><span class="priority-badge ${maint.priority}">${getPriorityText(maint.priority)}</span></td>
            <td><span class="status-badge ${maint.status}">${getStatusText(maint.status)}</span></td>
            <td>${maint.cost ? `€${parseFloat(maint.cost).toFixed(2)}` : 'N/A'}</td>
            <td>
                ${maint.status !== 'completed' ? `
                    <button class="btn btn-sm btn-success" onclick="completeMaintenance('${maint.id}')" title="Concluir Manutenção">
                        <i class="fas fa-check"></i>
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-primary" onclick="editMaintenance('${maint.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteMaintenance('${maint.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Funções auxiliares para textos
function getStatusText(status) {
    const statusMap = {
        'available': 'Disponível',
        'reserved': 'Reservada',
        'maintenance': 'Manutenção',
        'inactive': 'Inativa',
        'active': 'Ativa',
        'completed': 'Concluída',
        'cancelled': 'Cancelada',
        'scheduled': 'Agendada',
        'in_progress': 'Em Progresso'
    };
    return statusMap[status] || status;
}

function getVehicleTypeText(type) {
    const typeMap = {
        'ligeiro': 'Ligeiro',
        'comercial': 'Comercial',
        'pesado': 'Pesado',
        'moto': 'Motociclo'
    };
    return typeMap[type] || type;
}

function getFuelTypeText(fuel) {
    const fuelMap = {
        'gasolina': 'Gasolina',
        'diesel': 'Diesel',
        'hibrido': 'Híbrido',
        'eletrico': 'Elétrico',
        'gas': 'Gás'
    };
    return fuelMap[fuel] || fuel || 'N/A';
}

function getVehicleIcon(type) {
    const iconMap = {
        'ligeiro': 'fa-car',
        'comercial': 'fa-truck',
        'pesado': 'fa-truck-moving',
        'moto': 'fa-motorcycle'
    };
    return iconMap[type] || 'fa-car';
}

function getMaintenanceTypeText(type) {
    const typeMap = {
        'revisao': 'Revisão',
        'inspecao': 'Inspeção',
        'reparacao': 'Reparação',
        'pneus': 'Pneus',
        'oleo': 'Mudança de Óleo',
        'filtros': 'Filtros',
        'travoes': 'Travões',
        'outro': 'Outro'
    };
    return typeMap[type] || type;
}

function getPriorityText(priority) {
    const priorityMap = {
        'low': 'Baixa',
        'medium': 'Média',
        'high': 'Alta',
        'urgent': 'Urgente'
    };
    return priorityMap[priority] || priority;
}

// Funções CRUD para Viaturas
function openVehicleModal(vehicleId = null) {
    const modal = document.getElementById('vehicleModal');
    const title = document.getElementById('vehicleModalTitle');
    const form = document.getElementById('vehicleForm');
    
    if (vehicleId) {
        const vehicle = vehicles.find(v => v.id === vehicleId);
        title.textContent = 'Editar Viatura';
        
        document.getElementById('vehicleId').value = vehicle.id;
        document.getElementById('vehicleBrand').value = vehicle.brand;
        document.getElementById('vehicleModel').value = vehicle.model;
        document.getElementById('vehicleLicensePlate').value = vehicle.license_plate;
        document.getElementById('vehicleYear').value = vehicle.year || '';
        document.getElementById('vehicleType').value = vehicle.vehicle_type;
        document.getElementById('vehicleFuelType').value = vehicle.fuel_type || '';
        document.getElementById('vehicleMileage').value = vehicle.mileage || 0;
        document.getElementById('vehicleStatus').value = vehicle.status;
    } else {
        title.textContent = 'Nova Viatura';
        form.reset();
        document.getElementById('vehicleStatus').value = 'available';
    }
    
    modal.style.display = 'block';
}

function editVehicle(vehicleId) {
    openVehicleModal(vehicleId);
}

async function deleteVehicle(vehicleId) {
    if (!confirm('Tem certeza que deseja eliminar esta viatura?')) return;
    
    try {
        const response = await fetch(`/api/vehicles/${vehicleId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Viatura eliminada com sucesso', 'success');
            loadFleetData();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Erro ao eliminar viatura', 'error');
        }
    } catch (error) {
        console.error('Erro ao eliminar viatura:', error);
        showNotification('Erro ao eliminar viatura', 'error');
    }
}

// Funções CRUD para Reservas
function openReservationModal(reservationId = null) {
    const modal = document.getElementById('reservationModal');
    const title = document.getElementById('reservationModalTitle');
    const form = document.getElementById('reservationForm');
    const vehicleSelect = document.getElementById('reservationVehicle');
    const mileageSection = document.getElementById('mileageSection');
    const statusSection = document.getElementById('statusSection');
    
    // Carregar viaturas disponíveis
    vehicleSelect.innerHTML = '<option value="">Selecionar viatura</option>';
    vehicles.forEach(vehicle => {
        if (vehicle.status === 'available' || (reservationId && reservations.find(r => r.id === reservationId)?.vehicle_id === vehicle.id)) {
            vehicleSelect.innerHTML += `<option value="${vehicle.id}">${vehicle.brand} ${vehicle.model} (${vehicle.license_plate})</option>`;
        }
    });
    
    if (reservationId) {
        const reservation = reservations.find(r => r.id === reservationId);
        title.textContent = 'Editar Reserva';
        
        document.getElementById('reservationId').value = reservation.id;
        document.getElementById('reservationVehicle').value = reservation.vehicle_id;
        document.getElementById('reservationUser').value = reservation.user_name;
        document.getElementById('reservationStartDate').value = reservation.start_date;
        document.getElementById('reservationEndDate').value = reservation.end_date;
        document.getElementById('reservationPurpose').value = reservation.purpose || '';
        document.getElementById('reservationStatus').value = reservation.status;
        document.getElementById('reservationMileageStart').value = reservation.mileage_start || '';
        document.getElementById('reservationMileageEnd').value = reservation.mileage_end || '';
        
        mileageSection.style.display = 'block';
        statusSection.style.display = 'block';
    } else {
        title.textContent = 'Nova Reserva';
        form.reset();
        mileageSection.style.display = 'none';
        statusSection.style.display = 'none';
    }
    
    modal.style.display = 'block';
}

function editReservation(reservationId) {
    openReservationModal(reservationId);
}

async function cancelReservation(reservationId) {
    if (!confirm('Tem certeza que deseja cancelar esta reserva?')) return;
    
    try {
        const response = await fetch(`/api/vehicle-reservations/${reservationId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Reserva cancelada com sucesso', 'success');
            loadFleetData();
            // Atualizar alertas de viaturas reservadas
            loadReservedVehiclesAlerts();
            // Recarregar a lista se estiver visível
            const reservedSection = document.getElementById('reservedVehiclesSection');
            if (reservedSection && reservedSection.style.display !== 'none') {
                loadReservedVehicles();
            }
        } else {
            const error = await response.json();
            showNotification(error.error || 'Erro ao cancelar reserva', 'error');
        }
    } catch (error) {
        console.error('Erro ao cancelar reserva:', error);
        showNotification('Erro ao cancelar reserva', 'error');
    }
}

async function deleteReservation(reservationId) {
    if (!confirm('Tem certeza que deseja eliminar esta reserva?')) return;
    
    try {
        const response = await fetch(`/api/vehicle-reservations/${reservationId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Reserva eliminada com sucesso', 'success');
            loadFleetData();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Erro ao eliminar reserva', 'error');
        }
    } catch (error) {
        console.error('Erro ao eliminar reserva:', error);
        showNotification('Erro ao eliminar reserva', 'error');
    }
}

async function completeReservation(reservationId) {
    if (!confirm('Tem certeza que deseja marcar esta reserva como concluída?')) return;
    
    try {
        // Obter dados da reserva atual
        const reservationData = reservations.find(r => r.id === reservationId);
        if (!reservationData) {
            showNotification('Reserva não encontrada', 'error');
            return;
        }
        
        // Preparar dados para atualização
        const updatedData = {
            vehicleId: reservationData.vehicle_id,
            userName: reservationData.user_name,
            startDate: reservationData.start_date,
            endDate: reservationData.end_date,
            purpose: reservationData.purpose,
            status: 'completed',
            mileageStart: reservationData.mileage_start,
            mileageEnd: reservationData.mileage_end
        };
        
        const response = await fetch(`/api/vehicle-reservations/${reservationId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedData)
        });
        
        if (response.ok) {
            showNotification('Reserva concluída com sucesso', 'success');
            loadFleetData();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Erro ao concluir reserva', 'error');
        }
    } catch (error) {
        console.error('Erro ao concluir reserva:', error);
        showNotification('Erro ao concluir reserva', 'error');
    }
}

async function autoCompleteReservation(reservationId) {
    try {
        // Obter dados da reserva atual
        const reservationData = reservations.find(r => r.id === reservationId);
        if (!reservationData || reservationData.status !== 'active') {
            return; // Não fazer nada se a reserva não existir ou já não estiver ativa
        }
        
        // Preparar dados para atualização automática
        const updatedData = {
            vehicleId: reservationData.vehicle_id,
            userName: reservationData.user_name,
            startDate: reservationData.start_date,
            endDate: reservationData.end_date,
            purpose: reservationData.purpose,
            status: 'completed',
            mileageStart: reservationData.mileage_start,
            mileageEnd: reservationData.mileage_end
        };
        
        const response = await fetch(`/api/vehicle-reservations/${reservationId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedData)
        });
        
        if (response.ok) {
            // Recarregar dados silenciosamente (sem notificação para auto-conclusão)
            loadFleetData();
        }
    } catch (error) {
        console.error('Erro ao auto-concluir reserva:', error);
    }
}

// Funções CRUD para Manutenções
function openMaintenanceModal(maintenanceId = null) {
    const modal = document.getElementById('maintenanceModal');
    const title = document.getElementById('maintenanceModalTitle');
    const form = document.getElementById('maintenanceForm');
    const vehicleSelect = document.getElementById('maintenanceVehicle');
    const statusSection = document.getElementById('maintenanceStatusSection');
    const nextMaintenanceSection = document.getElementById('nextMaintenanceSection');
    
    // Carregar viaturas
    vehicleSelect.innerHTML = '<option value="">Selecionar viatura</option>';
    vehicles.forEach(vehicle => {
        vehicleSelect.innerHTML += `<option value="${vehicle.id}">${vehicle.brand} ${vehicle.model} (${vehicle.license_plate})</option>`;
    });
    
    if (maintenanceId) {
        const maint = maintenance.find(m => m.id === maintenanceId);
        title.textContent = 'Editar Manutenção';
        
        document.getElementById('maintenanceId').value = maint.id;
        document.getElementById('maintenanceVehicle').value = maint.vehicle_id;
        document.getElementById('maintenanceType').value = maint.maintenance_type;
        document.getElementById('maintenanceDescription').value = maint.description || '';
        document.getElementById('maintenanceCost').value = maint.cost || '';
        document.getElementById('maintenanceScheduledDate').value = maint.scheduled_date;
        document.getElementById('maintenanceNextDate').value = maint.next_maintenance_date || '';
        document.getElementById('maintenanceMileage').value = maint.mileage_at_maintenance || '';
        document.getElementById('maintenancePriority').value = maint.priority;
        document.getElementById('maintenanceStatus').value = maint.status;
        document.getElementById('maintenanceCompletedDate').value = maint.completed_date || '';
        
        statusSection.style.display = 'block';
        nextMaintenanceSection.style.display = 'block';
    } else {
        title.textContent = 'Agendar Manutenção';
        form.reset();
        document.getElementById('maintenancePriority').value = 'medium';
        statusSection.style.display = 'none';
        nextMaintenanceSection.style.display = 'none';
    }
    
    modal.style.display = 'block';
}

function editMaintenance(maintenanceId) {
    openMaintenanceModal(maintenanceId);
}

async function deleteMaintenance(maintenanceId) {
    if (!confirm('Tem certeza que deseja eliminar esta manutenção?')) return;
    
    try {
        const response = await fetch(`/api/vehicle-maintenance/${maintenanceId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Manutenção eliminada com sucesso', 'success');
            loadFleetData();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Erro ao eliminar manutenção', 'error');
        }
    } catch (error) {
        console.error('Erro ao eliminar manutenção:', error);
        showNotification('Erro ao eliminar manutenção', 'error');
    }
}

async function completeMaintenance(maintenanceId) {
    if (!confirm('Tem certeza que deseja marcar esta manutenção como concluída?')) return;
    
    try {
        // Obter dados da manutenção atual
        const maintenanceData = maintenance.find(m => m.id === maintenanceId);
        if (!maintenanceData) {
            showNotification('Manutenção não encontrada', 'error');
            return;
        }
        
        // Preparar dados para atualização
        const updatedData = {
            vehicleId: maintenanceData.vehicle_id,
            maintenanceType: maintenanceData.maintenance_type,
            description: maintenanceData.description,
            cost: maintenanceData.cost,
            scheduledDate: maintenanceData.scheduled_date,
            completedDate: new Date().toISOString().split('T')[0],
            nextMaintenanceDate: maintenanceData.next_maintenance_date,
            mileageAtMaintenance: maintenanceData.mileage_at_maintenance,
            status: 'completed',
            priority: maintenanceData.priority
        };
        
        const response = await fetch(`/api/vehicle-maintenance/${maintenanceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedData)
        });
        
        if (response.ok) {
            showNotification('Manutenção concluída com sucesso', 'success');
            loadFleetData();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Erro ao concluir manutenção', 'error');
        }
    } catch (error) {
        console.error('Erro ao concluir manutenção:', error);
        showNotification('Erro ao concluir manutenção', 'error');
    }
}

// Event Listeners da Frota
document.addEventListener('DOMContentLoaded', function() {
    // Tabs da frota
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Atualizar botões ativos
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Mostrar conteúdo correspondente
            tabContents.forEach(content => {
                if (content.id === `${tabName}-tab`) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });
    
    // Botões principais
    const addVehicleBtn = document.getElementById('addVehicleBtn');
    const addReservationBtn = document.getElementById('addReservationBtn');
    const addMaintenanceBtn = document.getElementById('addMaintenanceBtn');
    
    if (addVehicleBtn) {
        addVehicleBtn.addEventListener('click', () => openVehicleModal());
    }
    
    if (addReservationBtn) {
        addReservationBtn.addEventListener('click', () => openReservationModal());
    }
    
    if (addMaintenanceBtn) {
        addMaintenanceBtn.addEventListener('click', () => openMaintenanceModal());
    }
    
    // Formulários
    const vehicleForm = document.getElementById('vehicleForm');
    const reservationForm = document.getElementById('reservationForm');
    const maintenanceForm = document.getElementById('maintenanceForm');
    
    if (vehicleForm) {
        vehicleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                brand: document.getElementById('vehicleBrand').value,
                model: document.getElementById('vehicleModel').value,
                licensePlate: document.getElementById('vehicleLicensePlate').value,
                year: document.getElementById('vehicleYear').value || null,
                vehicleType: document.getElementById('vehicleType').value,
                fuelType: document.getElementById('vehicleFuelType').value || null,
                mileage: document.getElementById('vehicleMileage').value || 0,
                status: document.getElementById('vehicleStatus').value
            };
            
            const vehicleId = document.getElementById('vehicleId').value;
            const isEdit = vehicleId !== '';
            
            try {
                const response = await fetch(`/api/vehicles${isEdit ? `/${vehicleId}` : ''}`, {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                if (response.ok) {
                    showNotification(`Viatura ${isEdit ? 'atualizada' : 'criada'} com sucesso`, 'success');
                    vehicleModal.style.display = 'none';
                    loadFleetData();
                } else {
                    const error = await response.json();
                    showNotification(error.error || `Erro ao ${isEdit ? 'atualizar' : 'criar'} viatura`, 'error');
                }
            } catch (error) {
                console.error('Erro ao salvar viatura:', error);
                showNotification(`Erro ao ${isEdit ? 'atualizar' : 'criar'} viatura`, 'error');
            }
        });
    }
    
    if (reservationForm) {
        reservationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                vehicleId: document.getElementById('reservationVehicle').value,
                userName: document.getElementById('reservationUser').value,
                startDate: document.getElementById('reservationStartDate').value,
                endDate: document.getElementById('reservationEndDate').value,
                purpose: document.getElementById('reservationPurpose').value || null,
                status: document.getElementById('reservationStatus').value || 'active',
                mileageStart: document.getElementById('reservationMileageStart').value || null,
                mileageEnd: document.getElementById('reservationMileageEnd').value || null
            };
            
            const reservationId = document.getElementById('reservationId').value;
            const isEdit = reservationId !== '';
            
            try {
                const response = await fetch(`/api/vehicle-reservations${isEdit ? `/${reservationId}` : ''}`, {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                if (response.ok) {
                    showNotification(`Reserva ${isEdit ? 'atualizada' : 'criada'} com sucesso`, 'success');
                    reservationModal.style.display = 'none';
                    loadFleetData();
                } else {
                    const error = await response.json();
                    showNotification(error.error || `Erro ao ${isEdit ? 'atualizar' : 'criar'} reserva`, 'error');
                }
            } catch (error) {
                console.error('Erro ao salvar reserva:', error);
                showNotification(`Erro ao ${isEdit ? 'atualizar' : 'criar'} reserva`, 'error');
            }
        });
    }
    
    if (maintenanceForm) {
        maintenanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                vehicleId: document.getElementById('maintenanceVehicle').value,
                maintenanceType: document.getElementById('maintenanceType').value,
                description: document.getElementById('maintenanceDescription').value || null,
                cost: document.getElementById('maintenanceCost').value || null,
                scheduledDate: document.getElementById('maintenanceScheduledDate').value,
                completedDate: document.getElementById('maintenanceCompletedDate').value || null,
                nextMaintenanceDate: document.getElementById('maintenanceNextDate').value || null,
                mileageAtMaintenance: document.getElementById('maintenanceMileage').value || null,
                status: document.getElementById('maintenanceStatus').value || 'scheduled',
                priority: document.getElementById('maintenancePriority').value
            };
            
            const maintenanceId = document.getElementById('maintenanceId').value;
            const isEdit = maintenanceId !== '';
            
            try {
                const response = await fetch(`/api/vehicle-maintenance${isEdit ? `/${maintenanceId}` : ''}`, {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                if (response.ok) {
                    showNotification(`Manutenção ${isEdit ? 'atualizada' : 'agendada'} com sucesso`, 'success');
                    maintenanceModal.style.display = 'none';
                    loadFleetData();
                } else {
                    const error = await response.json();
                    showNotification(error.error || `Erro ao ${isEdit ? 'atualizar' : 'agendar'} manutenção`, 'error');
                }
            } catch (error) {
                console.error('Erro ao salvar manutenção:', error);
                showNotification(`Erro ao ${isEdit ? 'atualizar' : 'agendar'} manutenção`, 'error');
            }
        });
    }
    
    // Event listeners para fechar modais
    const closeVehicleModal = document.getElementById('closeVehicleModal');
    const closeReservationModal = document.getElementById('closeReservationModal');
    const closeMaintenanceModal = document.getElementById('closeMaintenanceModal');
    const cancelVehicleBtn = document.getElementById('cancelVehicleBtn');
    const cancelReservationBtn = document.getElementById('cancelReservationBtn');
    const cancelMaintenanceBtn = document.getElementById('cancelMaintenanceBtn');
    
    [closeVehicleModal, cancelVehicleBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                vehicleModal.style.display = 'none';
            });
        }
    });
    
    [closeReservationModal, cancelReservationBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                reservationModal.style.display = 'none';
            });
        }
    });
    
    [closeMaintenanceModal, cancelMaintenanceBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                maintenanceModal.style.display = 'none';
            });
        }
    });
    
    // Fechar modais ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target === vehicleModal) vehicleModal.style.display = 'none';
        if (e.target === reservationModal) reservationModal.style.display = 'none';
        if (e.target === maintenanceModal) maintenanceModal.style.display = 'none';
    });
});

// Atualizar navegação para carregar dados da frota quando necessário
document.addEventListener('DOMContentLoaded', function() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const page = this.getAttribute('data-page');
            if (page === 'fleet' || page === 'dashboard') {
                setTimeout(() => {
                    loadFleetData();
                }, 100);
            }
            
            // Carregar veículos para relatórios quando a aba de relatórios for acessada
            if (page === 'fleet') {
                setTimeout(() => {
                    loadVehiclesForReport();
                }, 200);
            }
        });
    });
});

// FUNÇÕES DE RELATÓRIOS
async function generateVehicleReport() {
    const vehicleId = reportVehicleSelect.value;
    const dateFrom = reportDateFrom.value;
    const dateTo = reportDateTo.value;

    if (!vehicleId) {
        showNotification('Por favor, selecione um veículo', 'warning');
        return;
    }

    try {
        generateReportBtn.disabled = true;
        generateReportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

        const response = await fetch(`/api/vehicles/${vehicleId}/report`);
        
        if (!response.ok) {
            throw new Error('Erro ao carregar dados do relatório');
        }

        const data = await response.json();
        
        // Filtrar dados por data se especificado
        let filteredReservations = data.reservations;
        let filteredMaintenances = data.maintenances;

        if (dateFrom) {
            filteredReservations = filteredReservations.filter(r => 
                new Date(r.start_date) >= new Date(dateFrom)
            );
            filteredMaintenances = filteredMaintenances.filter(m => 
                m.scheduled_date && new Date(m.scheduled_date) >= new Date(dateFrom)
            );
        }

        if (dateTo) {
            filteredReservations = filteredReservations.filter(r => 
                new Date(r.end_date) <= new Date(dateTo)
            );
            filteredMaintenances = filteredMaintenances.filter(m => 
                m.scheduled_date && new Date(m.scheduled_date) <= new Date(dateTo)
            );
        }

        displayReport(data.vehicle, filteredReservations, filteredMaintenances, dateFrom, dateTo);
        exportPdfBtn.disabled = false;

    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        showNotification('Erro ao gerar relatório', 'error');
    } finally {
        generateReportBtn.disabled = false;
        generateReportBtn.innerHTML = '<i class="fas fa-chart-line"></i> Ver Relatório';
    }
}

function displayReport(vehicle, reservations, maintenances, dateFrom, dateTo) {
    // Atualizar título
    const reportTitle = document.getElementById('reportTitle');
    if (reportTitle) {
        reportTitle.textContent = `Relatório: ${vehicle.brand} ${vehicle.model} (${vehicle.license_plate})`;
    }

    // Calcular estatísticas
    const totalCost = maintenances.reduce((sum, m) => sum + (m.cost || 0), 0);
    const completedReservations = reservations.filter(r => r.status === 'completed').length;
    const completedMaintenances = maintenances.filter(m => m.status === 'completed').length;

    // Atualizar resumo
    const reportSummary = document.getElementById('reportSummary');
    if (reportSummary) {
        const period = dateFrom && dateTo 
            ? `${new Date(dateFrom).toLocaleDateString('pt-PT')} - ${new Date(dateTo).toLocaleDateString('pt-PT')}`
            : 'Todos os registos';

        reportSummary.innerHTML = `
            <div class="summary-card">
                <span class="summary-number">${reservations.length}</span>
                <span class="summary-label">Total Reservas</span>
            </div>
            <div class="summary-card">
                <span class="summary-number">${completedReservations}</span>
                <span class="summary-label">Reservas Concluídas</span>
            </div>
            <div class="summary-card">
                <span class="summary-number">${maintenances.length}</span>
                <span class="summary-label">Total Manutenções</span>
            </div>
            <div class="summary-card">
                <span class="summary-number">€${totalCost.toFixed(2)}</span>
                <span class="summary-label">Custo Manutenções</span>
            </div>
            <div class="summary-card">
                <span class="summary-number">${vehicle.mileage.toLocaleString()}</span>
                <span class="summary-label">Quilometragem</span>
            </div>
            <div style="grid-column: 1 / -1; text-align: center; margin-top: 10px; font-size: 14px; opacity: 0.9;">
                Período: ${period}
            </div>
        `;
    }

    // Preencher tabela de reservas
    const reservationsBody = document.getElementById('reportReservationsBody');
    if (reservationsBody) {
        if (reservations.length > 0) {
            reservationsBody.innerHTML = reservations.map(reservation => `
                <tr>
                    <td>${reservation.user_name}</td>
                    <td>${new Date(reservation.start_date).toLocaleDateString('pt-PT')}</td>
                    <td>${new Date(reservation.end_date).toLocaleDateString('pt-PT')}</td>
                    <td>${reservation.purpose || '-'}</td>
                    <td><span class="status status-${reservation.status}">${getStatusText(reservation.status)}</span></td>
                    <td>${reservation.mileage_start || '-'}</td>
                    <td>${reservation.mileage_end || '-'}</td>
                </tr>
            `).join('');
        } else {
            reservationsBody.innerHTML = `
                <tr>
                    <td colspan="7" class="no-data-message">Nenhuma reserva encontrada para o período selecionado</td>
                </tr>
            `;
        }
    }

    // Preencher tabela de manutenções
    const maintenanceBody = document.getElementById('reportMaintenanceBody');
    if (maintenanceBody) {
        if (maintenances.length > 0) {
            maintenanceBody.innerHTML = maintenances.map(maintenance => `
                <tr>
                    <td>${maintenance.maintenance_type}</td>
                    <td>${maintenance.description || '-'}</td>
                    <td>${maintenance.scheduled_date ? new Date(maintenance.scheduled_date).toLocaleDateString('pt-PT') : '-'}</td>
                    <td>${maintenance.completed_date ? new Date(maintenance.completed_date).toLocaleDateString('pt-PT') : '-'}</td>
                    <td>€${(maintenance.cost || 0).toFixed(2)}</td>
                    <td><span class="status status-${maintenance.status}">${getStatusText(maintenance.status)}</span></td>
                    <td>${maintenance.mileage_at_maintenance || '-'} km</td>
                </tr>
            `).join('');
        } else {
            maintenanceBody.innerHTML = `
                <tr>
                    <td colspan="7" class="no-data-message">Nenhuma manutenção encontrada para o período selecionado</td>
                </tr>
            `;
        }
    }

    // Mostrar conteúdo do relatório
    reportContent.style.display = 'block';
    reportContent.scrollIntoView({ behavior: 'smooth' });
}

async function exportReportToPdf() {
    const vehicleId = reportVehicleSelect.value;
    const dateFrom = reportDateFrom.value;
    const dateTo = reportDateTo.value;

    if (!vehicleId) {
        showNotification('Por favor, selecione um veículo', 'warning');
        return;
    }

    try {
        exportPdfBtn.disabled = true;
        exportPdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando PDF...';

        const response = await fetch(`/api/vehicles/${vehicleId}/report/pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ dateFrom, dateTo })
        });

        if (!response.ok) {
            throw new Error('Erro ao gerar PDF');
        }

        // Criar blob e download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        // Obter nome do arquivo do header ou criar um padrão
        const disposition = response.headers.get('Content-Disposition');
        let filename = 'relatorio_veiculo.pdf';
        if (disposition && disposition.includes('filename=')) {
            filename = disposition.split('filename=')[1].replace(/"/g, '');
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showNotification('PDF gerado com sucesso!', 'success');

    } catch (error) {
        console.error('Erro ao exportar PDF:', error);
        showNotification('Erro ao gerar PDF', 'error');
    } finally {
        exportPdfBtn.disabled = false;
        exportPdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Exportar PDF';
    }
}

async function loadVehiclesForReport() {
    try {
        const response = await fetch('/api/vehicles');
        const vehicles = await response.json();
        
        if (reportVehicleSelect) {
            reportVehicleSelect.innerHTML = '<option value="">Selecione um veículo...</option>';
            vehicles.forEach(vehicle => {
                const option = document.createElement('option');
                option.value = vehicle.id;
                option.textContent = `${vehicle.brand} ${vehicle.model} (${vehicle.license_plate})`;
                reportVehicleSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar veículos:', error);
    }
}

// ============================================================================
// TELEFONES INTERNOS
// ============================================================================

let phones = [];

async function loadPhones() {
    try {
        const response = await fetch('/api/phones');
        if (!response.ok) {
            throw new Error('Erro ao carregar telefones');
        }
        
        phones = await response.json();
        allPhones = phones; // Armazenar na variável global para pesquisa no dashboard
        displayPhones(phones);
    } catch (error) {
        console.error('Erro ao carregar telefones:', error);
        allPhones = []; // Resetar em caso de erro
        const phonesGrid = document.getElementById('phonesGrid');
        if (phonesGrid) {
            phonesGrid.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar lista de telefones. Verifique se o ficheiro telefones.xlsx existe.</p>
                </div>
            `;
        }
    }
}

function displayPhones(phonesToDisplay) {
    const phonesGrid = document.getElementById('phonesGrid');
    if (!phonesGrid) return;
    
    if (phonesToDisplay.length === 0) {
        phonesGrid.innerHTML = `
            <div class="no-phones-message">
                <i class="fas fa-phone-slash"></i>
                <p>Nenhum telefone encontrado</p>
            </div>
        `;
        return;
    }
    
    // Agrupar telefones por setor
    const phonesBySector = {};
    phonesToDisplay.forEach(phone => {
        const sector = phone.sector || 'Sem Setor';
        if (!phonesBySector[sector]) {
            phonesBySector[sector] = [];
        }
        phonesBySector[sector].push(phone);
    });
    
    // Gerar HTML agrupado por setor
    let html = '';
    Object.keys(phonesBySector).sort().forEach(sector => {
        html += `
            <div class="phone-sector">
                <h3 class="sector-title">
                    <i class="fas fa-building"></i>
                    ${sector}
                </h3>
                <div class="phone-list">
        `;
        
        phonesBySector[sector].forEach(phone => {
            html += `
                <div class="phone-card">
                    <div class="phone-info">
                        <div class="phone-name">
                            <i class="fas fa-user"></i>
                            ${phone.name}
                        </div>
                        <div class="phone-extension">
                            <i class="fas fa-phone"></i>
                            <span class="extension-number">${phone.extension}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    phonesGrid.innerHTML = html;
}

function searchPhones(searchTerm) {
    const normalizedSearch = normalizeText(searchTerm);
    
    if (!normalizedSearch) {
        displayPhones(phones);
        return;
    }
    
    const filtered = phones.filter(phone => {
        const sector = normalizeText(phone.sector);
        const name = normalizeText(phone.name);
        const extension = normalizeText(phone.extension);
        
        return sector.includes(normalizedSearch) ||
               name.includes(normalizedSearch) ||
               extension.includes(normalizedSearch);
    });
    
    displayPhones(filtered);
}

// Setup event listeners para telefones
function setupPhonesEventListeners() {
    const phoneSearch = document.getElementById('phoneSearch');
    if (phoneSearch) {
        phoneSearch.addEventListener('input', (e) => {
            searchPhones(e.target.value);
        });
    }
    
    // Setup para pesquisa rápida no dashboard
    setupDashboardPhoneSearch();
}

// Variável global para armazenar os telefones
let allPhones = [];

// Setup da pesquisa de telefones no dashboard
function setupDashboardPhoneSearch() {
    const dashboardPhoneSearch = document.getElementById('dashboardPhoneSearch');
    const resultsDropdown = document.getElementById('dashboardPhoneResults');
    
    if (!dashboardPhoneSearch || !resultsDropdown) return;
    
    // Evento de input para pesquisa em tempo real
    dashboardPhoneSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.trim();
        
        if (searchTerm.length < 2) {
            resultsDropdown.classList.remove('show');
            return;
        }
        
        searchDashboardPhones(searchTerm);
    });
    
    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (e) => {
        if (!dashboardPhoneSearch.contains(e.target) && !resultsDropdown.contains(e.target)) {
            resultsDropdown.classList.remove('show');
        }
    });
    
    // Focar no input ao clicar no container
    const searchContainer = dashboardPhoneSearch.parentElement;
    searchContainer.addEventListener('click', (e) => {
        if (e.target !== dashboardPhoneSearch) {
            dashboardPhoneSearch.focus();
        }
    });
}

// Pesquisar telefones no dashboard
function searchDashboardPhones(searchTerm) {
    const resultsDropdown = document.getElementById('dashboardPhoneResults');
    
    if (!allPhones || allPhones.length === 0) {
        resultsDropdown.innerHTML = `
            <div class="phone-result-empty">
                <i class="fas fa-exclamation-circle"></i>
                <p>Nenhum telefone disponível</p>
            </div>
        `;
        resultsDropdown.classList.add('show');
        return;
    }
    
    const normalizedSearch = normalizeText(searchTerm);
    
    // Filtrar telefones que correspondem à pesquisa
    const results = allPhones.filter(phone => {
        const sector = normalizeText(phone.sector || '');
        const name = normalizeText(phone.name || '');
        const extension = normalizeText(phone.extension || '');
        
        return sector.includes(normalizedSearch) || 
               name.includes(normalizedSearch) || 
               extension.includes(normalizedSearch);
    });
    
    if (results.length === 0) {
        resultsDropdown.innerHTML = `
            <div class="phone-result-empty">
                <i class="fas fa-search"></i>
                <p>Nenhum resultado encontrado para "${searchTerm}"</p>
            </div>
        `;
        resultsDropdown.classList.add('show');
        return;
    }
    
    // Limitar a 8 resultados
    const limitedResults = results.slice(0, 8);
    
    resultsDropdown.innerHTML = limitedResults.map(phone => `
        <div class="phone-result-item">
            <div class="phone-result-sector">${phone.sector || 'Sem setor'}</div>
            <div class="phone-result-name">${phone.name || 'Sem nome'}</div>
            <div class="phone-result-extension">
                <i class="fas fa-phone"></i> ${phone.extension || 'N/A'}
            </div>
        </div>
    `).join('');
    
    if (results.length > 8) {
        resultsDropdown.innerHTML += `
            <div class="phone-result-item" style="text-align: center; color: var(--text-muted); font-style: italic; cursor: default;">
                +${results.length - 8} resultados adicionais...
            </div>
        `;
    }
    
    resultsDropdown.classList.add('show');
}

// ================================
// BANNER DO DASHBOARD
// ================================

function updateDashboardBanner() {
    const bannerElement = document.getElementById('dashboardBanner');
    if (!bannerElement) return;
    
    const bannerItems = [];
    
    // Reuniões hoje
    const today = new Date().toDateString();
    const meetingsToday = meetings.filter(m => new Date(m.date_time).toDateString() === today);
    if (meetingsToday.length > 0) {
        const activeCount = meetingsToday.filter(m => m.status === 'active').length;
        if (activeCount > 0) {
            bannerItems.push(`<span class="banner-item success">📅 ${activeCount} reunião${activeCount > 1 ? 'ões' : ''} ativa${activeCount > 1 ? 's' : ''}</span>`);
        } else {
            bannerItems.push(`<span class="banner-item">📅 ${meetingsToday.length} reunião${meetingsToday.length > 1 ? 'ões' : ''} hoje</span>`);
        }
    } else {
        bannerItems.push(`<span class="banner-item">📅 Sem reuniões agendadas hoje</span>`);
    }
    
    // Tarefas pendentes
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const completedTasks = tasks.filter(t => t.status === 'completed');
    if (pendingTasks.length > 0) {
        const overdueTasks = pendingTasks.filter(t => t.due_date && new Date(t.due_date) < new Date());
        if (overdueTasks.length > 0) {
            bannerItems.push(`<span class="banner-item alert">⚠️ ${overdueTasks.length} tarefa${overdueTasks.length > 1 ? 's' : ''} atrasada${overdueTasks.length > 1 ? 's' : ''}</span>`);
        } else {
            bannerItems.push(`<span class="banner-item">📋 ${pendingTasks.length} tarefa${pendingTasks.length > 1 ? 's' : ''} pendente${pendingTasks.length > 1 ? 's' : ''} • ${completedTasks.length} concluída${completedTasks.length > 1 ? 's' : ''}</span>`);
        }
    } else {
        bannerItems.push(`<span class="banner-item success">✅ Todas as tarefas concluídas (${completedTasks.length})</span>`);
    }
    
    // Contentores Marítimos e Expedições Aéreas
    if (containers && containers.length > 0) {
        const maritimeContainers = containers.filter(c => isMaritime(c));
        const airExpeditions = containers.filter(c => !isMaritime(c));
        
        // Contentores marítimos com alertas
        const maritimeAlerts = maritimeContainers.filter(c => {
            if (!c.arrival_date) return false;
            const arrivalDate = new Date(c.arrival_date);
            const daysUntil = Math.ceil((arrivalDate - new Date()) / (1000 * 60 * 60 * 24));
            return daysUntil >= 0 && daysUntil <= 7;
        });
        
        if (maritimeAlerts.length > 0) {
            const urgentAlerts = maritimeAlerts.filter(c => {
                const arrivalDate = new Date(c.arrival_date);
                const daysUntil = Math.ceil((arrivalDate - new Date()) / (1000 * 60 * 60 * 24));
                return daysUntil <= 2;
            });
            
            if (urgentAlerts.length > 0) {
                bannerItems.push(`<span class="banner-item alert">🚢 ${urgentAlerts.length} contentor${urgentAlerts.length > 1 ? 'es' : ''} urgente${urgentAlerts.length > 1 ? 's' : ''} (≤2 dias)</span>`);
            } else {
                bannerItems.push(`<span class="banner-item warning">🚢 ${maritimeAlerts.length} contentor${maritimeAlerts.length > 1 ? 'es' : ''} chegando (≤7 dias)</span>`);
            }
        } else {
            bannerItems.push(`<span class="banner-item">🚢 ${maritimeContainers.length} contentor${maritimeContainers.length > 1 ? 'es' : ''} marítimo${maritimeContainers.length > 1 ? 's' : ''}</span>`);
        }
        
        // Expedições aéreas
        if (airExpeditions.length > 0) {
            bannerItems.push(`<span class="banner-item">✈️ ${airExpeditions.length} expediç${airExpeditions.length > 1 ? 'ões' : 'ão'} aérea${airExpeditions.length > 1 ? 's' : ''}</span>`);
        }
    }
    
    // Expedições (camião)
    if (expeditions && expeditions.length > 0) {
        const upcomingExpeditions = expeditions.filter(e => {
            if (!e.date || e.status === 'completed') return false;
            const expeditionDate = new Date(e.date);
            const daysUntil = Math.ceil((expeditionDate - new Date()) / (1000 * 60 * 60 * 24));
            return daysUntil >= 0 && daysUntil <= 5;
        });
        
        const completedExpeditions = expeditions.filter(e => e.status === 'completed');
        
        if (upcomingExpeditions.length > 0) {
            const urgentExpeditions = upcomingExpeditions.filter(e => {
                const priority = (e.priority || '').toLowerCase();
                return priority === 'alta' || priority === 'urgente';
            });
            
            if (urgentExpeditions.length > 0) {
                bannerItems.push(`<span class="banner-item alert">🚚 ${urgentExpeditions.length} expediç${urgentExpeditions.length > 1 ? 'ões' : 'ão'} urgente${urgentExpeditions.length > 1 ? 's' : ''}</span>`);
            } else {
                bannerItems.push(`<span class="banner-item warning">🚚 ${upcomingExpeditions.length} expediç${upcomingExpeditions.length > 1 ? 'ões' : 'ão'} próxima${upcomingExpeditions.length > 1 ? 's' : ''}</span>`);
            }
        } else {
            bannerItems.push(`<span class="banner-item">🚚 ${expeditions.length} expediç${expeditions.length > 1 ? 'ões' : 'ão'} • ${completedExpeditions.length} concluída${completedExpeditions.length > 1 ? 's' : ''}</span>`);
        }
    }
    
    // Viaturas (Frota)
    if (vehicles && vehicles.length > 0) {
        const availableVehicles = vehicles.filter(v => v.status === 'available');
        const reservedVehicles = vehicles.filter(v => v.status === 'reserved');
        const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance');
        
        if (maintenanceVehicles.length > 0) {
            bannerItems.push(`<span class="banner-item warning">🔧 ${maintenanceVehicles.length} viatura${maintenanceVehicles.length > 1 ? 's' : ''} em manutenção</span>`);
        }
        
        if (reservedVehicles.length > 0) {
            bannerItems.push(`<span class="banner-item">🚗 ${availableVehicles.length} disponível${availableVehicles.length > 1 ? 'eis' : ''} • ${reservedVehicles.length} reservada${reservedVehicles.length > 1 ? 's' : ''}</span>`);
        } else if (availableVehicles.length > 0) {
            bannerItems.push(`<span class="banner-item success">🚗 ${availableVehicles.length}/${vehicles.length} viatura${availableVehicles.length > 1 ? 's' : ''} disponível${availableVehicles.length > 1 ? 'eis' : ''}</span>`);
        } else {
            bannerItems.push(`<span class="banner-item">🚗 ${vehicles.length} viatura${vehicles.length > 1 ? 's' : ''} na frota</span>`);
        }
    }
    
    // Backup (última verificação)
    if (backups && backups.length > 0) {
        const lastBackup = backups[0]; // Assumindo que os backups estão ordenados por data
        const backupDate = new Date(lastBackup.created_at);
        const hoursAgo = Math.floor((new Date() - backupDate) / (1000 * 60 * 60));
        
        if (hoursAgo < 24) {
            bannerItems.push(`<span class="banner-item success">💾 Backup recente (${hoursAgo}h atrás)</span>`);
        } else {
            const daysAgo = Math.floor(hoursAgo / 24);
            bannerItems.push(`<span class="banner-item warning">💾 Último backup há ${daysAgo} dia${daysAgo > 1 ? 's' : ''}</span>`);
        }
    } else {
        bannerItems.push(`<span class="banner-item alert">💾 Nenhum backup encontrado</span>`);
    }
    
    // Duplicar items para criar efeito de scroll infinito
    const duplicatedItems = [...bannerItems, ...bannerItems];
    bannerElement.innerHTML = duplicatedItems.join('');
}


