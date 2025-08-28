/* Compact tasks.js — updated for new HTML/CSS structure
   - Works with hierarchical tasks
   - Keeps all previous logic intact
   - Fixes modal & parent dropdown references
*/

const API_BASE_URL = 'http://127.0.0.1:8000/api';

// -------------------- Auth & Fetch Helpers --------------------
async function authenticatedFetch(url, options = {}) {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) { window.location.href = 'login.html'; return; }

    const opts = {
        ...options,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            ...(options.headers || {})
        }
    };
    if (['POST','PUT','PATCH'].includes((opts.method || 'GET').toUpperCase())) {
        opts.headers['Content-Type'] = 'application/json';
    }

    let res = await fetch(url, opts);
    if (res.status === 401) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href='login.html';
            return res;
        }
        opts.headers['Authorization'] = `Bearer ${localStorage.getItem('accessToken')}`;
        res = await fetch(url, opts);
    }
    return res;
}

async function refreshAccessToken() {
    const refresh = localStorage.getItem('refreshToken');
    if (!refresh) return false;
    try {
        const res = await fetch(`${API_BASE_URL}/token/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh })
        });
        if (!res.ok) return false;
        const data = await res.json();
        localStorage.setItem('accessToken', data.access);
        return true;
    } catch (e) { console.error('Refresh token error', e); return false; }
}

// -------------------- Small Utilities --------------------
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }
function formatDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseSortValue(sortVal) {
    const parts = (sortVal || '').split('_');
    if (parts.length === 2) return { field: parts[0], order: parts[1] };
    return null;
}

// -------------------- API WRAPPERS --------------------
async function apiGetTasks(params = {}) {
    const qsParts = new URLSearchParams();
    if (params.search) qsParts.append('search', params.search);
    if (params.category && params.category !== 'all') qsParts.append('category', params.category);
    if (params.status && params.status !== 'all') qsParts.append('completed', params.status);
    if (params.sortBy) {
        const so = parseSortValue(params.sortBy);
        if (so) { qsParts.append('sort_by', so.field); qsParts.append('order', so.order); }
    }
    const url = `${API_BASE_URL}/tasks/?${qsParts.toString()}`;
    const res = await authenticatedFetch(url);
    if (!res || !res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
}

async function apiGetAllTasksForDropdown() {
    const res = await authenticatedFetch(`${API_BASE_URL}/tasks/?all_tasks=true`);
    if (!res || !res.ok) throw new Error('Failed to fetch all tasks');
    return res.json();
}

async function apiGetStats() {
    const res = await authenticatedFetch(`${API_BASE_URL}/tasks/stats/`);
    if (!res || !res.ok) throw new Error('Failed to fetch stats');
    return res.json();
}

async function apiGetTask(id) {
    const res = await authenticatedFetch(`${API_BASE_URL}/tasks/${id}/`);
    if (!res || !res.ok) throw new Error('Failed to fetch task');
    return res.json();
}

async function apiGetSubtasks(id) {
    const res = await authenticatedFetch(`${API_BASE_URL}/tasks/${id}/subtasks/`);
    if (!res || !res.ok) throw new Error('Failed to fetch subtasks');
    return res.json();
}

async function apiCreateTask(payload) {
    const res = await authenticatedFetch(`${API_BASE_URL}/tasks/`, { method: 'POST', body: JSON.stringify(payload) });
    if (!res || !res.ok) return { ok:false, data: await tryReadJSON(res) };
    return { ok:true, data: await res.json() };
}

async function apiUpdateTask(id, payload, method = 'PUT') {
    const res = await authenticatedFetch(`${API_BASE_URL}/tasks/${id}/`, { method, body: JSON.stringify(payload) });
    if (!res || !res.ok) return { ok:false, data: await tryReadJSON(res) };
    return { ok:true, data: await res.json() };
}

async function apiDeleteTask(id) {
    const res = await authenticatedFetch(`${API_BASE_URL}/tasks/${id}/`, { method: 'DELETE' });
    if (!res) throw new Error('No response from server');
    if (res.status === 204 || res.ok) return true;
    throw await tryReadJSON(res);
}

async function tryReadJSON(res) {
    try { return await res.json(); } catch { return { detail: 'Unknown error' }; }
}

// -------------------- DOM REFERENCES --------------------
let globalSearchInput, showAddTaskFormButton, addTaskForm, addTaskFeedback;
let newTaskTitleInput, newTaskDescriptionInput, newTaskDueDateInput, newTaskCategorySelect, newTaskParentSelect;
let totalTasksCard, pendingTasksCard, completedTasksCard, overdueTasksCard;
let filterCategorySelect, filterStatusSelect, sortBySelect, applyFiltersSortButton, resetFiltersSortButton;
let tasksListContainer, noTasksMessage, loadingMessage;
let editTaskModal, editTaskForm, editTaskFeedback, editTaskTitleInput, editTaskDescriptionInput;
let editTaskDueDateInput, editTaskCategorySelect, editTaskParentSelect, editTaskIdInput, closeButtons;
let allTasksForParentDropdown = [];

// -------------------- UI Rendering --------------------
function createTaskCard(task, depth = 0) {
    const card = document.createElement('div');
    card.id = `task-card-${task.id}`;
    card.className = `task-card depth-${depth} ${task.completed ? 'completed' : ''}`;
    card.dataset.taskId = task.id;
    card.dataset.depth = depth;

    const today = new Date(); today.setHours(0,0,0,0);
    let isOverdue = false;
    if (task.due_date && !task.completed) {
        const due = new Date(task.due_date); due.setHours(0,0,0,0);
        if (due < today) isOverdue = true;
    }
    const statusTag = task.completed ? '<span class="tag completed">Completed</span>' :
                      isOverdue ? '<span class="tag overdue">Overdue</span>' :
                      '<span class="tag incomplete">Pending</span>';

    const dueDate = task.due_date ? formatDate(task.due_date) : 'N/A';
    const desc = task.description ? task.description : 'No description.';

    card.innerHTML = `
        <div class="card-header">
            <button class="task-toggle" data-task-id="${task.id}" style="visibility:${task.has_subtasks ? 'visible' : 'hidden'}">▶</button>
            <h3 class="card-title">${escapeHtml(task.title)}</h3>
            <div class="card-status-info">${statusTag}</div>
        </div>
        <p class="card-description">${escapeHtml(desc)}</p>
        <div class="card-footer">
            <div class="card-meta">
                <span>Due: ${dueDate}</span>
                <span>Category: ${escapeHtml(task.category || 'None')}</span>
            </div>
            <div class="card-actions">
                <button class="add-subtask-button" data-parent-id="${task.id}" title="Add Subtask">+</button>
                <button class="complete-toggle-button" data-task-id="${task.id}" title="${task.completed ? 'Mark Incomplete' : 'Mark Completed'}">
                    ${task.completed ? '&#x2714;' : '&#x2713;'}
                </button>
                <button class="edit-button" data-task-id="${task.id}" title="Edit Task">⚙️</button>
                <button class="delete-button" data-task-id="${task.id}" title="Delete Task">🗑️</button>
            </div>
        </div>
    `;
    return card;
}

function escapeHtml(str='') {
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[m]);
}

function renderTaskCards(tasks, container, depth=0) {
    tasks.forEach(task => {
        const card = createTaskCard(task, depth);
        container.appendChild(card);
        if (task.has_subtasks) {
            const wrapper = document.createElement('div');
            wrapper.id = `subtasks-wrapper-${task.id}`;
            wrapper.className = `subtasks-wrapper depth-${depth}`;
            wrapper.style.display = 'none';
            card.after(wrapper);
        }
    });
}

// -------------------- Dropdown population --------------------
function populateParentTaskDropdowns(excludeTaskId = null, currentParentId = null) {
    const sources = [newTaskParentSelect, editTaskParentSelect];
    sources.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '<option value="">No Parent (Top-Level Task)</option>';
        allTasksForParentDropdown.forEach(t => {
            if (t.id === excludeTaskId) return;
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.title;
            if (currentParentId !== null && Number(currentParentId) === t.id) opt.selected = true;
            sel.appendChild(opt);
        });
    });
}

// -------------------- Data Fetch & UI Update --------------------
async function fetchAndDisplayStats() {
    try {
        const stats = await apiGetStats();
        totalTasksCard.textContent = stats.total_tasks ?? 0;
        pendingTasksCard.textContent = stats.pending_tasks ?? 0;
        completedTasksCard.textContent = stats.completed_tasks ?? 0;
        overdueTasksCard.textContent = stats.overdue_tasks ?? 0;
    } catch (e) { console.error('Stats error', e); }
}

async function fetchAllTasksForDropdown() {
    try {
        allTasksForParentDropdown = await apiGetAllTasksForDropdown();
        populateParentTaskDropdowns();
    } catch (e) {
        try { allTasksForParentDropdown = await apiGetTasks({}); populateParentTaskDropdowns(); }
        catch (err) { console.error('Dropdown fetch failed', err); }
    }
}

async function fetchAndRenderTasks(params = {}) {
    loadingMessage.style.display = 'block';
    tasksListContainer.innerHTML = '';
    try {
        const tasks = await apiGetTasks(params);
        loadingMessage.style.display = 'none';
        if (!tasks.length) { noTasksMessage.style.display = 'block'; return; }
        noTasksMessage.style.display = 'none';
        renderTaskCards(tasks, tasksListContainer, 0);
    } catch (e) {
        console.error('Fetch tasks error', e);
        loadingMessage.style.display = 'none';
        tasksListContainer.innerHTML = `<p class="feedback-message" style="color:#dc3545;">Failed to load tasks.</p>`;
    }
}

// -------------------- Modal helpers --------------------
function showAddTaskSection(parentId = null) {
    const addModal = qs('#add-task-modal');
    addModal.style.display = 'flex';
    addTaskFeedback.textContent = '';
    addTaskForm.reset();
    newTaskParentSelect.value = parentId || '';
}

function openEditTaskModalFromObject(task) {
    editTaskIdInput.value = task.id;
    editTaskTitleInput.value = task.title;
    editTaskDescriptionInput.value = task.description || '';
    editTaskDueDateInput.value = formatDate(task.due_date);
    editTaskCategorySelect.value = task.category || '';
    populateParentTaskDropdowns(task.id, task.parent_task);
    editTaskFeedback.textContent = '';
    editTaskModal.style.display = 'flex';
}

function closeEditTaskModal() {
    editTaskModal.style.display = 'none';
    editTaskForm.reset();
    editTaskFeedback.textContent = '';
}

// -------------------- Delegated Event Handler --------------------
async function onTaskContainerClick(e) {
    const toggleButton = e.target.closest('.task-toggle');
    if (toggleButton) {
        const taskId = toggleButton.dataset.taskId;
        const parentCard = document.getElementById(`task-card-${taskId}`);
        const subtasksWrapper = document.getElementById(`subtasks-wrapper-${taskId}`);
        if (!parentCard || !subtasksWrapper) return;
        if (toggleButton.classList.contains('expanded')) {
            subtasksWrapper.style.display='none'; toggleButton.classList.remove('expanded');
        } else {
            subtasksWrapper.style.display='block'; toggleButton.classList.add('expanded');
            if (!subtasksWrapper.hasChildNodes()) {
                const subtasks = await apiGetSubtasks(taskId);
                renderTaskCards(subtasks, subtasksWrapper, Number(parentCard.dataset.depth)+1);
            }
        }
    }

    const addSubtaskBtn = e.target.closest('.add-subtask-button');
    if (addSubtaskBtn) {
        showAddTaskSection(addSubtaskBtn.dataset.parentId);
    }

    const completeBtn = e.target.closest('.complete-toggle-button');
    if (completeBtn) {
        const taskId = completeBtn.dataset.taskId;
        const card = document.getElementById(`task-card-${taskId}`);
        const newStatus = !(card.classList.contains('completed'));
        try { await apiUpdateTask(taskId, { completed: newStatus }, 'PATCH'); fetchAndDisplayStats(); fetchAndRenderTasks(); }
        catch (err) { console.error(err); }
    }

    const editBtn = e.target.closest('.edit-button');
    if (editBtn) {
        const task = await apiGetTask(editBtn.dataset.taskId);
        openEditTaskModalFromObject(task);
    }

    const deleteBtn = e.target.closest('.delete-button');
    if (deleteBtn && confirm('Are you sure to delete this task?')) {
        try { await apiDeleteTask(deleteBtn.dataset.taskId); fetchAndDisplayStats(); fetchAndRenderTasks(); }
        catch(err){ console.error(err); alert('Failed to delete task.'); }
    }
}

// -------------------- Initialization --------------------
function init() {
    globalSearchInput = qs('#global-search-tasks');
    showAddTaskFormButton = qs('#show-add-task-form-button');
    addTaskForm = qs('#add-task-form');
    addTaskFeedback = document.createElement('p'); addTaskForm.appendChild(addTaskFeedback);
    newTaskTitleInput = qs('#new-task-title');
    newTaskDescriptionInput = qs('#new-task-description');
    newTaskDueDateInput = qs('#new-task-due-date');
    newTaskCategorySelect = qs('#new-task-category');
    newTaskParentSelect = qs('#add-task-parent-id');

    totalTasksCard = qs('#stat-total-tasks');
    pendingTasksCard = qs('#stat-pending-tasks');
    completedTasksCard = qs('#stat-completed-tasks');
    overdueTasksCard = qs('#stat-overdue-tasks');

    filterCategorySelect = qs('#filter-category');
    filterStatusSelect = qs('#filter-status');
    sortBySelect = qs('#sort-by');
    applyFiltersSortButton = qs('#apply-filters-sort');
    resetFiltersSortButton = qs('#reset-filters-sort');

    tasksListContainer = qs('.task-grid-container');
    noTasksMessage = qs('#no-tasks-message');
    loadingMessage = qs('.loading-message');

    editTaskModal = qs('#edit-task-modal');
    editTaskForm = qs('#edit-task-form');
    editTaskFeedback = document.createElement('p'); editTaskForm.appendChild(editTaskFeedback);
    editTaskIdInput = qs('#edit-task-id');
    editTaskTitleInput = qs('#edit-task-form #edit-task-title');
    editTaskDescriptionInput = qs('#edit-task-form #edit-task-description');
    editTaskDueDateInput = qs('#edit-task-form #edit-task-due-date');
    editTaskCategorySelect = qs('#edit-task-form #edit-task-category');
    editTaskParentSelect = qs('#edit-task-parent-id');
    closeButtons = qsa('.close-button');

    // ---------------- Event Listeners ----------------
    showAddTaskFormButton.addEventListener('click', ()=>showAddTaskSection());
    addTaskForm.addEventListener('submit', async e=>{
        e.preventDefault();
        const payload = {
            title: newTaskTitleInput.value,
            description: newTaskDescriptionInput.value,
            due_date: newTaskDueDateInput.value || null,
            category: newTaskCategorySelect.value || null,
            parent_task: newTaskParentSelect.value || null
        };
        const res = await apiCreateTask(payload);
        if (res.ok) { addTaskForm.reset(); qs('#add-task-modal').style.display='none'; fetchAndDisplayStats(); fetchAndRenderTasks(); fetchAllTasksForDropdown(); }
        else addTaskFeedback.textContent = res.data.detail || 'Failed to add task.';
    });

    editTaskForm.addEventListener('submit', async e=>{
        e.preventDefault();
        const payload = {
            title: editTaskTitleInput.value,
            description: editTaskDescriptionInput.value,
            due_date: editTaskDueDateInput.value || null,
            category: editTaskCategorySelect.value || null,
            parent_task: editTaskParentSelect.value || null
        };
        const res = await apiUpdateTask(editTaskIdInput.value, payload);
        if (res.ok) { closeEditTaskModal(); fetchAndDisplayStats(); fetchAndRenderTasks(); fetchAllTasksForDropdown(); }
        else editTaskFeedback.textContent = res.data.detail || 'Failed to update task.';
    });

    closeButtons.forEach(b=>b.addEventListener('click',()=>{
        const modal = b.closest('.modal'); if(modal) modal.style.display='none';
    }));
    window.addEventListener('click', e=>{
        if(e.target.id==='add-task-modal'||e.target.id==='edit-task-modal') e.target.style.display='none';
    });

    tasksListContainer.addEventListener('click', onTaskContainerClick);

    applyFiltersSortButton.addEventListener('click', ()=>{
        fetchAndRenderTasks({
            search: globalSearchInput.value,
            category: filterCategorySelect.value,
            status: filterStatusSelect.value,
            sortBy: sortBySelect.value
        });
    });

    resetFiltersSortButton.addEventListener('click', ()=>{
        globalSearchInput.value=''; filterCategorySelect.value='all'; filterStatusSelect.value='all'; sortBySelect.value='created_at_desc';
        fetchAndRenderTasks();
    });

    // ---------------- Initial fetch ----------------
    fetchAllTasksForDropdown();
    fetchAndDisplayStats();
    fetchAndRenderTasks();
}

// -------------------- Run --------------------
document.addEventListener('DOMContentLoaded', init);
