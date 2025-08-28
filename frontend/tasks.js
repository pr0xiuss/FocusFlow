/* Compact tasks.js — works with your task.html IDs/classes
   - Uses same localStorage keys: accessToken, refreshToken
   - Endpoints expect DRF router from previous changes:
     GET/POST /api/tasks/
     GET/PUT/PATCH/DELETE /api/tasks/{id}/
     GET /api/tasks/{id}/subtasks/
     GET /api/tasks/stats/
     token refresh at /api/token/refresh/
*/

// tasks.js - Fully merged and fixed version for all features with correct new DOM structure

const API_BASE_URL = 'http://127.0.0.1:8000/api';

// -------------------- Auth & Fetch Helpers --------------------
async function authenticatedFetch(url, options = {}) {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
        window.location.href = 'login.html';
        return;
    }
    const opts = {
        ...options,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            ...(options.headers || {})
        }
    };
    if (['POST', 'PUT', 'PATCH'].includes((opts.method || 'GET').toUpperCase())) {
        opts.headers['Content-Type'] = 'application/json';
    }
    let res = await fetch(url, opts);
    if (res.status === 401) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = 'login.html';
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
    } catch (e) {
        console.error('Refresh token error', e);
        return false;
    }
}

// -------------------- Small Utilities --------------------
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }
function formatDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseSortValue(sortVal) {
    const parts = (sortVal || '').split('_');
    if (parts.length === 2) return { field: parts[0], order: parts[1] };
    return null;
}
function escapeHtml(str = '') {
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
}

// -------------------- API WRAPPERS --------------------
async function apiGetTasks(params = {}) {
    const qsParts = new URLSearchParams();
    if (params.search) qsParts.append('search', params.search);
    if (params.category && params.category !== 'all') qsParts.append('category', params.category);
    if (params.status && params.status !== 'all') qsParts.append('completed', params.status);
    if (params.sortBy) {
        const so = parseSortValue(params.sortBy);
        if (so) {
            qsParts.append('sort_by', so.field);
            qsParts.append('order', so.order);
        }
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
    const res = await authenticatedFetch(`${API_BASE_URL}/tasks/`, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    if (!res || !res.ok) return { ok: false, data: await tryReadJSON(res) };
    return { ok: true, data: await res.json() };
}
async function apiUpdateTask(id, payload, method = 'PUT') {
    const res = await authenticatedFetch(`${API_BASE_URL}/tasks/${id}/`, {
        method,
        body: JSON.stringify(payload)
    });
    if (!res || !res.ok) return { ok: false, data: await tryReadJSON(res) };
    return { ok: true, data: await res.json() };
}
async function apiDeleteTask(id) {
    const res = await authenticatedFetch(`${API_BASE_URL}/tasks/${id}/`, {
        method: 'DELETE'
    });
    if (!res) throw new Error('No response from server');
    if (res.status === 204 || res.ok) return true;
    throw await tryReadJSON(res);
}
async function tryReadJSON(res) {
    try { return await res.json(); }
    catch { return { detail: 'Unknown error' }; }
}

// -------------------- DOM REFERENCES --------------------
let globalSearchInput, showAddTaskFormButton, addTaskSection, addTaskModal,addTaskForm, cancelAddTaskButton, addTaskFeedback, addTaskParentIdInput;
let newTaskTitleInput, newTaskDescriptionInput, newTaskDueDateInput, newTaskCategorySelect, newTaskParentSelect;
let totalTasksCard, pendingTasksCard, completedTasksCard, overdueTasksCard;
let filterCategorySelect, filterStatusSelect, sortBySelect, applyFiltersSortButton, resetFiltersSortButton;
let tasksListContainer, noTasksMessage, loadingMessage;
let editTaskModal, editTaskForm, editTaskFeedback, editTaskTitleInput, editTaskDescriptionInput;
let editTaskDueDateInput, editTaskCategorySelect, editTaskParentSelect, editTaskIdInput, closeButtons;
let allTasksForParentDropdown = [];


// -------------------- UI Rendering --------------------
async function renderTaskCards(tasks, container, depth = 0) {
    for (const task of tasks) {
        const card = createTaskCard(task, depth);
        container.appendChild(card);

        if (task.has_subtasks) {
            const wrapper = document.createElement('div');
            wrapper.id = `subtasks-wrapper-${task.id}`;
            wrapper.className = `subtasks-wrapper depth-${depth}`;
            wrapper.style.display = 'none';
            card.after(wrapper);
        }
    }
}
function createTaskCard(task, depth = 0) {
    const card = document.createElement('div');
    card.id = `task-card-${task.id}`;
    card.className = `task-card depth-${depth} ${task.completed ? 'completed' : ''}`;
    card.dataset.taskId = task.id;
    card.dataset.depth = depth;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let isOverdue = false;
    if (task.due_date && !task.completed) {
        const due = new Date(task.due_date);
        due.setHours(0, 0, 0, 0);
        if (due < today) isOverdue = true;
    }
    const statusTag = task.completed ? 'Completed' : isOverdue ? 'Overdue' : 'Pending';
    const dueDate = task.due_date ? formatDate(task.due_date) : 'N/A';
    const desc = task.description ? task.description : 'No description.';
    // Add your HTML for the task card here as needed, below is an example:
    card.innerHTML = `
        <div class="card-header">
            <span class="card-title">${escapeHtml(task.title)}</span>
            <button class="task-toggle" data-task-id="${task.id}" title="Toggle subtasks">▶</button>
        </div>
        <div class="card-status-info">
            <span class="tag ${task.completed ? "completed" : isOverdue ? "overdue" : "incomplete"}">${statusTag}</span>
        </div>
        <div class="card-description">${escapeHtml(desc)}</div>
        <div class="card-footer">
            <div class="card-meta">
                <span>Due: ${dueDate}</span>
                <span>Category: ${escapeHtml(task.category || "")}</span>
            </div>
            <div class="card-actions">
                <button class="complete-toggle-button" data-task-id="${task.id}" title="Mark Completed">${task.completed ? "✔" : "✓"}</button>
                <button class="edit-button" data-task-id="${task.id}" title="Edit">✎</button>
                <button class="delete-button" data-task-id="${task.id}" title="Delete">🗑️</button>
                <button class="add-subtask-button" data-parent-id="${task.id}" title="Add Subtask">➕</button>
            </div>
        </div>`;
    return card;
}

// -------------------- Dropdown population --------------------
function populateParentTaskDropdowns(excludeTaskId = null, currentParentId = null) {
    const sources = [newTaskParentSelect, editTaskParentSelect];
    sources.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'None';
        sel.appendChild(opt);
        allTasksForParentDropdown.forEach(t => {
            if (t.id === excludeTaskId) return;
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.title;
            if (currentParentId !== null && Number(currentParentId) === t.id) option.selected = true;
            sel.appendChild(option);
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
    } catch (e) {
        console.error('Stats error', e);
    }
}
async function fetchAllTasksForDropdown() {
    try {
        allTasksForParentDropdown = await apiGetAllTasksForDropdown();
        populateParentTaskDropdowns();
    } catch (e) {
        try {
            allTasksForParentDropdown = await apiGetTasks({});
            populateParentTaskDropdowns();
        } catch (err) {
            console.error('Dropdown fetch failed', err);
        }
    }
}
async function fetchAndRenderTasks(params = {}) {
    loadingMessage.style.display = 'block';
    tasksListContainer.innerHTML = '';
    try {
        const tasks = await apiGetTasks(params);
        loadingMessage.style.display = 'none';
        if (!tasks.length) {
            noTasksMessage.style.display = 'block';
            return;
        }
        noTasksMessage.style.display = 'none';
        await renderTaskCards(tasks, tasksListContainer, 0);
    } catch (e) {
        console.error('Fetch tasks error', e);
        loadingMessage.style.display = 'none';
        tasksListContainer.innerHTML = ` `;
    }
}

// -------------------- Modal helpers --------------------
function showAddTaskSection(parentId = null) {
    addTaskSection.style.display = 'block';
    addTaskFeedback.textContent = '';
    addTaskForm.reset();
    newTaskParentSelect.value = parentId || '';
    addTaskSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            subtasksWrapper.style.display = 'none';
            subtasksWrapper.innerHTML = '';
            toggleButton.classList.remove('expanded');
            toggleButton.textContent = '▶';
            return;
        }
        // expand and recursively fetch all subtasks
        toggleButton.classList.add('expanded');
        toggleButton.textContent = '▼';
        subtasksWrapper.style.display = 'block';
        try {
            const subtasks = await apiGetSubtasks(taskId);
            subtasksWrapper.innerHTML = '';
            if (subtasks.length) {
                const subContainer = document.createElement('div');
                subContainer.className = 'subtask-container';
                subtasksWrapper.appendChild(subContainer);
                await renderTaskCards(subtasks, subContainer, Number(parentCard.dataset.depth) + 1);
            } else {
                subtasksWrapper.innerHTML = ' ';
            }
        } catch (err) {
            subtasksWrapper.innerHTML = ` `;
            console.error(err);
        }
        return;
    }

    const deleteButton = e.target.closest('.delete-button');
    if (deleteButton) {
        const taskId = deleteButton.dataset.taskId;
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            await apiDeleteTask(taskId);
            const card = document.getElementById(`task-card-${taskId}`);
            if (card) card.remove();
            const wrapper = document.getElementById(`subtasks-wrapper-${taskId}`);
            if (wrapper) wrapper.remove();
            await fetchAndDisplayStats();
            await fetchAllTasksForDropdown();
            fetchAndRenderTasks(getCurrentFilterSortParams());
        } catch (err) {
            console.error('Delete error', err);
            alert('Failed to delete task.');
        }
        return;
    }

    const completeButton = e.target.closest('.complete-toggle-button');
    if (completeButton) {
        const taskId = completeButton.dataset.taskId;
        const taskCard = document.getElementById(`task-card-${taskId}`);
        const currentlyCompleted = taskCard.classList.contains('completed');
        try {
            const updated = await apiUpdateTask(taskId, { completed: !currentlyCompleted }, 'PATCH');
            if (!updated.ok) {
                const errMsg = (updated.data && (updated.data.detail || updated.data.completed || Object.values(updated.data)[0])) || 'Update failed';
                alert(errMsg);
                return;
            }
            // Update UI quickly
            if (updated.data.completed) {
                taskCard.classList.add('completed');
                completeButton.title = 'Mark Incomplete';
                completeButton.innerHTML = '✔';
            } else {
                taskCard.classList.remove('completed');
                completeButton.title = 'Mark Completed';
                completeButton.innerHTML = '✓';
            }
            await fetchAndDisplayStats();
            await fetchAllTasksForDropdown();
            fetchAndRenderTasks(getCurrentFilterSortParams());
        } catch (err) {
            console.error('Toggle complete error', err);
            alert('Failed to update status');
        }
        return;
    }

    const editBtn = e.target.closest('.edit-button');
    if (editBtn) {
        const id = editBtn.dataset.taskId;
        try {
            const task = await apiGetTask(id);
            openEditTaskModalFromObject(task);
        } catch (err) {
            console.error('Open edit error', err);
            alert('Could not load task');
        }
        return;
    }

    const addSubtaskBtn = e.target.closest('.add-subtask-button');
    if (addSubtaskBtn) {
        const parentId = addSubtaskBtn.dataset.parentId;
        showAddTaskSection(parentId);
        return;
    }
}

// -------------------- Forms: Add & Edit --------------------
async function onAddTaskSubmit(e) {
    e.preventDefault();
    addTaskFeedback.textContent = '';
    const payload = {
        title: newTaskTitleInput.value,
        description: newTaskDescriptionInput.value || null,
        due_date: newTaskDueDateInput.value || null,
        category: newTaskCategorySelect.value || null,
        parent_task: newTaskParentSelect.value || '' ? Number(newTaskParentSelect.value) : null,
        completed: false
    };
    try {
        const created = await apiCreateTask(payload);
        if (!created.ok) {
            const msg = created.data && (created.data.detail || Object.values(created.data)[0]) || 'Failed to add';
            addTaskFeedback.textContent = `Error: ${Array.isArray(msg) ? msg.join(', ') : msg}`;
            addTaskFeedback.style.color = '#dc3545';
            return;
        }
        addTaskFeedback.textContent = 'Task added successfully!';
        addTaskFeedback.style.color = '#28a745';
        addTaskForm.reset();
        addTaskSection.style.display = 'none';
        await fetchAndDisplayStats();
        await fetchAllTasksForDropdown();
        fetchAndRenderTasks(getCurrentFilterSortParams());
    } catch (err) {
        console.error('Add task error', err);
        addTaskFeedback.textContent = 'Network error';
        addTaskFeedback.style.color = '#dc3545';
    }
}
async function onEditTaskSubmit(e) {
    e.preventDefault();
    editTaskFeedback.textContent = '';
    const id = editTaskIdInput.value;
    const payload = {
        title: editTaskTitleInput.value,
        description: editTaskDescriptionInput.value || null,
        due_date: editTaskDueDateInput.value || null,
        category: editTaskCategorySelect.value || null,
        parent_task: editTaskParentSelect.value || '' ? Number(editTaskParentSelect.value) : null
    };
    try {
        const updated = await apiUpdateTask(id, payload, 'PUT');
        if (!updated.ok) {
            const msg = updated.data && (updated.data.detail || Object.values(updated.data)[0]) || 'Failed to update';
            editTaskFeedback.textContent = `Error: ${Array.isArray(msg) ? msg.join(', ') : msg}`;
            editTaskFeedback.style.color = '#dc3545';
            return;
        }
        editTaskFeedback.textContent = 'Task updated successfully!';
        editTaskFeedback.style.color = '#28a745';
        await fetchAndDisplayStats();
        await fetchAllTasksForDropdown();
        fetchAndRenderTasks(getCurrentFilterSortParams());
        setTimeout(closeEditTaskModal, 800);
    } catch (err) {
        console.error('Edit task error', err);
        editTaskFeedback.textContent = 'Network error';
        editTaskFeedback.style.color = '#dc3545';
    }
}

// -------------------- Helpers for UI state --------------------
function getCurrentFilterSortParams() {
    return {
        search: globalSearchInput.value,
        category: filterCategorySelect.value,
        status: filterStatusSelect.value,
        sortBy: sortBySelect.value
    };
}

// -------------------- Initialization --------------------
document.addEventListener('DOMContentLoaded', async () => {
    // assign DOM references
    globalSearchInput = qs('#global-search-tasks');
    showAddTaskFormButton = qs('#show-add-task-form-button');
    addTaskModal = qs('#add-task-section');
    addTaskForm = qs('#add-task-form');
    cancelAddTaskButton = qs('#cancel-add-task');
    addTaskFeedback = qs('#add-task-feedback');
    newTaskTitleInput = qs('#new-task-title');
    newTaskDescriptionInput = qs('#new-task-description');
    newTaskDueDateInput = qs('#new-task-due-date');
    newTaskCategorySelect = qs('#new-task-category');
    newTaskParentSelect = qs('#new-task-parent');
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
    editTaskFeedback = qs('#edit-task-feedback');
    editTaskTitleInput = qs('#edit-task-title');
    editTaskDescriptionInput = qs('#edit-task-description');
    editTaskDueDateInput = qs('#edit-task-due-date');
    editTaskCategorySelect = qs('#edit-task-category');
    editTaskParentSelect = qs('#edit-task-parent');
    editTaskIdInput = qs('#edit-task-id');
    closeButtons = qsa('.close-button');

    // ---------------- User Greeting and Logout ----------------
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
        window.location.href = 'login.html';
        return;
    }
    const decoded = (function decodeJwt(t) {
        try {
            const p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            return p;
        } catch (e) { return null; }
    })(accessToken);

    const userGreeting = qs('#user-greeting');
    if (userGreeting) {
        userGreeting.textContent = decoded && decoded.username ? `Hello, ${decoded.username}!` : 'Hello, User!';
    }
    const logoutButton = qs('#logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', e => {
            e.preventDefault();
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = 'login.html';
        });
    }

    // initial fetches
    fetchAndDisplayStats();
    fetchAllTasksForDropdown();
    fetchAndRenderTasks();

    // event bindings
    showAddTaskFormButton.addEventListener('click', () => showAddTaskSection());
    if (cancelAddTaskButton) {
        cancelAddTaskButton.addEventListener('click', () => {
            addTaskSection.style.display = 'none';
            addTaskForm.reset();
            addTaskFeedback.textContent = '';
        });
    }
    applyFiltersSortButton.addEventListener('click', () => fetchAndRenderTasks(getCurrentFilterSortParams()));
    resetFiltersSortButton.addEventListener('click', () => {
        globalSearchInput.value = '';
        filterCategorySelect.value = 'all';
        filterStatusSelect.value = 'all';
        sortBySelect.value = 'created_at_desc';
        fetchAndRenderTasks();
    });
    globalSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') applyFiltersSortButton.click(); });
    tasksListContainer.addEventListener('click', onTaskContainerClick);
    addTaskForm.addEventListener('submit', onAddTaskSubmit);
    closeButtons.forEach(b => b.addEventListener('click', closeEditTaskModal));
    window.addEventListener('click', (e) => { if (e.target === editTaskModal) closeEditTaskModal(); });
    editTaskForm.addEventListener('submit', onEditTaskSubmit);
});


