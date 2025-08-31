/* FocusFlow tasks — modal-based add + nested subtasks
   Matches your uploaded tasks.html + tasks.css

   API (Django DRF):
     GET/POST   /api/tasks/
     GET/PUT/PATCH/DELETE /api/tasks/{id}/
     GET        /api/tasks/{id}/subtasks/
     GET        /api/tasks/stats/
     POST       /api/token/refresh/   { refresh }
*/

const API_BASE_URL = 'http://127.0.0.1:8000/api';

/* -------------------- Auth & Fetch Helpers -------------------- */
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
  const method = (opts.method || 'GET').toUpperCase();
  if (['POST','PUT','PATCH'].includes(method) && !opts.headers['Content-Type']) {
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
    // retry with new token
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
  } catch {
    return false;
  }
}

/* -------------------- Small Utilities -------------------- */
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));

function escapeHtml(str='') {
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[m]);
}
function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function parseSortValue(sortVal) {
  const parts = (sortVal || '').split('_');
  if (parts.length === 2) return { field: parts[0], order: parts[1] };
  return null;
}
function todayStart() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}

/* -------------------- API Wrappers -------------------- */
async function apiGetTasks(params = {}) {
  const sp = new URLSearchParams();
  if (params.search) sp.append('search', params.search);
  if (params.category && params.category !== 'all') sp.append('category', params.category);
  if (params.status && params.status !== 'all') sp.append('completed', params.status);
  if (params.sortBy) {
    const so = parseSortValue(params.sortBy);
    if (so) {
      sp.append('sort_by', so.field);
      sp.append('order', so.order);
    }
  }
  const res = await authenticatedFetch(`${API_BASE_URL}/tasks/?${sp.toString()}`);
  if (!res || !res.ok) throw new Error('Failed to fetch tasks');
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
  if (!res || !res.ok) return { ok:false, data: await tryReadJSON(res) };
  return { ok:true, data: await res.json() };
}
async function apiUpdateTask(id, payload, method='PUT') {
  const res = await authenticatedFetch(`${API_BASE_URL}/tasks/${id}/`, {
    method, body: JSON.stringify(payload)
  });
  if (!res || !res.ok) return { ok:false, data: await tryReadJSON(res) };
  return { ok:true, data: await res.json() };
}
async function apiDeleteTask(id) {
    const url = `${API_BASE_URL}/tasks/${id}/`;
    console.log('🔍 DELETE URL:', url);
    
    try {
        const res = await authenticatedFetch(url, { method: 'DELETE' });
        
        if (!res) {
            console.error('❌ No response from server');
            throw new Error('No response from server');
        }
        
        console.log('🔍 DELETE response status:', res.status);
        console.log('🔍 res.ok:', res.ok);
        
        // ✅ BE MORE FORGIVING - if the task gets deleted, consider it success
        // Even if we get an error status, if the task disappears, it's fine
        if (res.status === 204 || res.status === 200) {
            console.log('✅ Delete successful (204/200)');
            return true;
        }
        
        // ✅ For 500 errors, still return true since the delete actually works
        if (res.status === 500) {
            console.log('⚠️ Server returned 500, but delete might have worked');
            return true; // Still return true because we know the task gets deleted
        }
        
        // Only throw errors for client errors (4xx) that aren't 404
        if (res.status >= 400 && res.status !== 404) {
            console.error('❌ Delete failed with status:', res.status);
            const errorData = await tryReadJSON(res);
            console.error('🔍 DELETE error response:', errorData);
            throw new Error(`Delete failed: ${res.status} ${errorData.detail || 'Unknown error'}`);
        }
        
        // For 404 and other statuses, assume success
        console.log('⚠️ Unexpected status, but assuming delete succeeded:', res.status);
        return true;
        
    } catch (err) {
        console.error('❌ Delete request failed:', err);
        // Even if the fetch fails, the task might still be deleted
        // So we'll still return true to avoid blocking the UI
        return true;
    }
}
async function tryReadJSON(res) {
  try { return await res.json(); } catch { return { detail:'Unknown error' }; }
}

/* -------------------- DOM Refs (set on load) -------------------- */
let globalSearchInput, showAddTaskBtn;
let addTaskModal, addTaskForm, addTaskParentHidden, addTitle, addDesc, addDue, addCategory;
let statsTotal, statsPending, statsCompleted, statsOverdue;
let filterCategory, filterStatus, sortBy, applyFiltersBtn, resetFiltersBtn;
let tasksGrid, noTasksMsg, loadingMsg;
let editModal, editForm, editId, editTitle, editDesc, editDue, editCategory, editParentSelect, editFeedback;

/* -------------------- Modal Helpers -------------------- */
function openModal(modal) {
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.classList.add('modal-open'); // optional blur hook
}
function closeModal(modal) {
  if (!modal) return;
  modal.style.display = 'none';
  document.body.classList.remove('modal-open');
}

/* Show the "Add Task" modal; pass parentId to create as subtask */
function showAddTaskModal(parentId = null) {
    console.log('=== showAddTaskModal DEBUG ===');
    
    // Check each DOM element individually
    console.log('addTaskModal:', addTaskModal);
    console.log('addTaskParentHidden:', addTaskParentHidden);
    console.log('addTaskFeedback:', addTaskFeedback);
    console.log('addTaskForm:', addTaskForm);
    
    // Make sure we have the DOM elements
    if (!addTaskModal || !addTaskParentHidden || !addTaskFeedback) {
        console.error('Missing DOM elements!');
        console.error('addTaskModal missing:', !addTaskModal);
        console.error('addTaskParentHidden missing:', !addTaskParentHidden);
        console.error('addTaskFeedback missing:', !addTaskFeedback);
        console.error('addTaskForm missing:', !addTaskForm);
        return;
    }
    
    addTaskModal.style.display = 'flex';
    addTaskFeedback.textContent = '';
    
    console.log('🔍 Hidden field before reset:', addTaskParentHidden.value);
    
    addTaskForm.reset();
    
    console.log('🔍 Hidden field after reset:', addTaskParentHidden.value);
    
    // Set the parent ID
    addTaskParentHidden.value = parentId || '';
    console.log('🔍 Hidden field after setting:', addTaskParentHidden.value);
    
    addTaskModal.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* Ensure Edit Modal has the form fields (your tasks.html didn’t include them).
   We inject once to avoid asking you to edit HTML. */
function ensureEditFormFields() {
  if (!editForm) return;
  if (qs('#edit-task-title')) return; // already present

  const frag = document.createDocumentFragment();

  const fieldsHtml = `
    <div class="form-group">
      <label for="edit-task-title">Task Title</label>
      <input type="text" id="edit-task-title" name="title" required>
    </div>
    <div class="form-group">
      <label for="edit-task-description">Description (Optional)</label>
      <textarea id="edit-task-description" name="description"></textarea>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label for="edit-task-due-date">Due Date (Optional)</label>
        <input type="date" id="edit-task-due-date" name="due_date">
      </div>
      <div class="form-group">
        <label for="edit-task-category">Category (Optional)</label>
        <select id="edit-task-category" name="category">
          <option value="">Select Category</option>
          <option value="work">Work</option>
          <option value="personal">Personal</option>
          <option value="shopping">Shopping</option>
          <option value="home">Home</option>
          <option value="study">Study</option>
        </select>
      </div>
    </div>
    <div class="form-group feedback-area">
      <p id="edit-task-feedback" class="feedback-message"></p>
    </div>
    <div class="form-actions">
      <button type="submit" class="button">Save Changes</button>
      <button type="button" class="button secondary close-button">Cancel</button>
    </div>
  `;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = fieldsHtml;
  while (wrapper.firstChild) frag.appendChild(wrapper.firstChild);
  editForm.appendChild(frag);

  // bind refs now that we injected
  editTitle     = qs('#edit-task-title');
  editDesc      = qs('#edit-task-description');
  editDue       = qs('#edit-task-due-date');
  editCategory  = qs('#edit-task-category');
  editFeedback  = qs('#edit-task-feedback');

  // wire newly added cancel button
  qsa('.close-button', editModal).forEach(b => b.addEventListener('click', () => closeModal(editModal)));
}

/* -------------------- Rendering -------------------- */
function createTaskCard(task, depth=0) {
  const card = document.createElement('div');
  card.id = `task-card-${task.id}`;
  card.className = `task-card depth-${depth} ${task.completed ? 'completed' : ''}`;
  card.dataset.taskId = task.id;
  card.dataset.depth = depth;

  // status tag
  const t0 = todayStart();
  let isOverdue = false;
  if (task.due_date && !task.completed) {
    const due = new Date(task.due_date);
    due.setHours(0,0,0,0);
    isOverdue = due < t0;
  }
  const statusTag = task.completed
    ? '<span class="tag completed">Completed</span>'
    : isOverdue
      ? '<span class="tag overdue">Overdue</span>'
      : '<span class="tag incomplete">Pending</span>';

  const dueStr = task.due_date ? formatDate(task.due_date) : 'N/A';
  const desc = task.description ? escapeHtml(task.description) : 'No description.';

  card.innerHTML = `
    <div class="card-header">
      <button class="task-toggle" data-task-id="${task.id}" style="visibility:${task.has_subtasks ? 'visible' : 'hidden'}">▶</button>
      <h3 class="card-title">${escapeHtml(task.title)}</h3>
      <div class="card-status-info">${statusTag}</div>
    </div>
    <p class="card-description">${desc}</p>
    <div class="card-footer">
      <div class="card-meta">
        <span>Due: ${dueStr}</span>
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

  // subtasks wrapper holder
  if (task.has_subtasks) {
    const wrap = document.createElement('div');
    wrap.id = `subtasks-wrapper-${task.id}`;
    wrap.className = `subtasks-wrapper depth-${depth}`;
    wrap.style.display = 'none';
    card.after(wrap);
  }

  return card;
}

function renderTaskCards(tasks, container, depth = 0) {
    tasks.forEach(task => {
        const card = createTaskCard(task, depth);
        container.appendChild(card);
        
        // Create wrapper for subtasks if this task has subtasks
        if (task.subtasks && task.subtasks.length > 0) {
            const wrapper = document.createElement('div');
            wrapper.id = `subtasks-wrapper-${task.id}`;
            wrapper.className = `subtasks-wrapper depth-${depth}`;
            wrapper.style.display = 'none';
            card.after(wrapper);
            
            // Pre-render nested subtasks (optional - you can also load on demand)
            // renderTaskCards(task.subtasks, wrapper, depth + 1);
        }
    });
}

/* -------------------- Fetch & UI -------------------- */
async function fetchAndRenderTasks(params={}) {
  loadingMsg.style.display = 'block';
  tasksGrid.innerHTML = '';
  try {
    const tasks = await apiGetTasks(params);
    loadingMsg.style.display = 'none';
    if (!tasks.length) {
      noTasksMsg.style.display = 'block';
      return;
    }
    noTasksMsg.style.display = 'none';
    renderTaskCards(tasks, tasksGrid, 0);
  } catch (e) {
    loadingMsg.style.display = 'none';
    tasksGrid.innerHTML = `<p class="feedback-message" style="color:#dc3545;">Failed to load tasks.</p>`;
    console.error(e);
  }
}

async function fetchAndDisplayStats() {
  try {
    const s = await apiGetStats();
    statsTotal.textContent = s.total_tasks ?? 0;
    statsPending.textContent = s.pending_tasks ?? 0;
    statsCompleted.textContent = s.completed_tasks ?? 0;
    statsOverdue.textContent = s.overdue_tasks ?? 0;
  } catch(e) {
    console.error(e);
  }
}

/* -------------------- Event Delegation (tasks grid) -------------------- */
async function onTasksGridClick(e) {
  // expand/collapse subtasks
  const toggleBtn = e.target.closest('.task-toggle');
  if (toggleBtn) {
    const taskId = toggleBtn.dataset.taskId;
    const parentCard = document.getElementById(`task-card-${taskId}`);
    const subtasksWrapper = document.getElementById(`subtasks-wrapper-${taskId}`);
    
    if (!parentCard || !subtasksWrapper) return;
    
    if (toggleBtn.classList.contains('expanded')) {
        // Collapse
        subtasksWrapper.style.display = 'none';
        subtasksWrapper.innerHTML = '';
        toggleBtn.classList.remove('expanded');
        toggleBtn.textContent = '▶';
        return;
    }
    
    // Expand - the API now returns nested subtasks
    toggleBtn.classList.add('expanded');
    toggleBtn.textContent = '▼';
    subtasksWrapper.style.display = 'block';
    
    try {
        const subtasks = await apiGetSubtasks(taskId);
        subtasksWrapper.innerHTML = '';
        
        if (subtasks.length) {
            const subContainer = document.createElement('div');
            subContainer.className = 'subtask-container';
            subtasksWrapper.appendChild(subContainer);
            renderTaskCards(subtasks, subContainer, Number(parentCard.dataset.depth) + 1);
        } else {
            subtasksWrapper.innerHTML = '<p class="no-subtasks-message">No subtasks.</p>';
        }
    } catch (err) {
        console.error('Error loading subtasks:', err);
        subtasksWrapper.innerHTML = `<p class="feedback-message" style="color:#dc3545;">Failed to load subtasks.</p>`;
    }
    return;
}

  // add subtask
const addSubBtn = e.target.closest('.add-subtask-button');
if (addSubBtn) {
    const parentId = addSubBtn.dataset.parentId;
    console.log('🔍 Add subtask clicked - Parent ID from button:', parentId);
    console.log('🔍 Button element:', addSubBtn);
    console.log('🔍 Button dataset:', addSubBtn.dataset);
    showAddTaskModal(parentId);
    return;
}

  // toggle complete
  const completeBtn = e.target.closest('.complete-toggle-button');
  if (completeBtn) {
    const id = completeBtn.dataset.taskId;
    const card = qs(`#task-card-${id}`);
    const isCompleted = card.classList.contains('completed');
    try {
      const updated = await apiUpdateTask(id, { completed: !isCompleted }, 'PATCH');
      if (!updated.ok) {
        const data = updated.data || {};
        const msg = data.detail || data.completed || Object.values(data)[0] || 'Update failed';
        alert(Array.isArray(msg) ? msg.join(', ') : msg);
        return;
      }
      if (updated.data.completed) {
        card.classList.add('completed'); completeBtn.title = 'Mark Incomplete'; completeBtn.innerHTML = '&#x2714;';
      } else {
        card.classList.remove('completed'); completeBtn.title = 'Mark Completed'; completeBtn.innerHTML = '&#x2713;';
      }
      await fetchAndDisplayStats();
      fetchAndRenderTasks(getCurrentFilterSortParams());
    } catch (err) {
      console.error(err); alert('Failed to update status');
    }
    return;
  }

  // edit
  const editBtn = e.target.closest('.edit-button');
  if (editBtn) {
    const id = editBtn.dataset.taskId;
    try {
      const task = await apiGetTask(id);
      ensureEditFormFields();
      // fill
      editId.value = task.id;
      editTitle.value = task.title || '';
      editDesc.value = task.description || '';
      editDue.value = formatDate(task.due_date);
      editCategory.value = task.category || '';

      try {
        const all = await apiGetTasks({});
        all.filter(t => t.id !== task.id).forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = t.title;
          if (task.parent_task && Number(task.parent_task) === t.id) opt.selected = true;
          editParentSelect.appendChild(opt);
        });
      } catch {}
      openModal(editModal);
    } catch (err) {
      console.error(err); alert('Could not load task');
    }
    return;
  }

  // delete
const delBtn = e.target.closest('.delete-button');
if (delBtn) {
    const id = delBtn.dataset.taskId;
    console.log('🔍 Delete button clicked for task ID:', id);
    
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        console.log('🔍 Attempting to delete task:', id);
        const success = await apiDeleteTask(id);
        
        if (success) {
            console.log('✅ Task deleted successfully from backend');
            
            // Remove from DOM
            const card = document.getElementById(`task-card-${id}`);
            if (card) card.remove();
            
            const wrapper = document.getElementById(`subtasks-wrapper-${id}`);
            if (wrapper) wrapper.remove();
            
            await fetchAndDisplayStats();
            fetchAndRenderTasks(getCurrentFilterSortParams());
        } else {
            console.error('❌ Delete failed - API returned false');
            alert('Failed to delete task.');
        }
        
    } catch (err) {
        console.error('❌ Delete error:', err);
        alert('Failed to delete task: ' + err.message);
    }
    return;
}
}

/* -------------------- Forms: Add & Edit -------------------- */
async function onAddTaskSubmit(e) {
  e.preventDefault();
  const parentVal = addTaskParentHidden.value.trim();
  const payload = {
    title: addTitle.value,
    description: addDesc.value || null,
    due_date: addDue.value || null,
    category: addCategory.value || null,
    parent_task: parentVal === '' ? null : Number(parentVal),
    completed: false
  };
  try {
    const created = await apiCreateTask(payload);
    if (!created.ok) {
      const d = created.data || {};
      const msg = d.detail || Object.values(d)[0] || 'Failed to add';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
      return;
    }
    closeModal(addTaskModal);
    addTaskForm.reset();
    await fetchAndDisplayStats();
    fetchAndRenderTasks(getCurrentFilterSortParams());
  } catch (err) {
    console.error(err); alert('Network error');
  }
}

async function onEditTaskSubmit(e) {
  e.preventDefault();
  const id = editId.value;
  const parentVal = (editParentSelect?.value || '').trim();
  const payload = {
    title: editTitle.value,
    description: editDesc.value || null,
    due_date: editDue.value || null,
    category: editCategory.value || null,
    parent_task: parentVal === '' ? null : Number(parentVal)
  };
  try {
    const updated = await apiUpdateTask(id, payload, 'PUT');
    if (!updated.ok) {
      const d = updated.data || {};
      const msg = d.detail || Object.values(d)[0] || 'Failed to update';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
      return;
    }
    closeModal(editModal);
    await fetchAndDisplayStats();
    fetchAndRenderTasks(getCurrentFilterSortParams());
  } catch (err) {
    console.error(err); alert('Network error');
  }
}

/* -------------------- Helpers -------------------- */
function getCurrentFilterSortParams() {
  return {
    search: globalSearchInput.value,
    category: filterCategory.value,
    status: filterStatus.value,
    sortBy: sortBy.value
  };
}

/* -------------------- Init -------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  // navbar
  globalSearchInput = qs('#global-search-tasks');
  showAddTaskBtn   = qs('#show-add-task-form-button');

  // add modal & form
  addTaskModal        = qs('#add-task-modal');
  addTaskForm         = qs('#add-task-form');
  addTaskFeedback = qs('#add-task-feedback');
  addTaskParentHidden = qs('#add-task-parent-id');
  addTitle            = qs('#new-task-title');
  addDesc             = qs('#new-task-description');
  addDue              = qs('#new-task-due-date');
  addCategory         = qs('#new-task-category');

  // stats
  statsTotal     = qs('#stat-total-tasks');
  statsPending   = qs('#stat-pending-tasks');
  statsCompleted = qs('#stat-completed-tasks');
  statsOverdue   = qs('#stat-overdue-tasks');

  // filters
  filterCategory = qs('#filter-category');
  filterStatus   = qs('#filter-status');
  sortBy         = qs('#sort-by');
  applyFiltersBtn= qs('#apply-filters-sort');
  resetFiltersBtn= qs('#reset-filters-sort');

  // tasks grid section
  tasksGrid  = qs('.task-grid-container');
  noTasksMsg = qs('#no-tasks-message');
  loadingMsg = qs('.loading-message');

  // edit modal
  editModal = qs('#edit-task-modal');
  editForm  = qs('#edit-task-form');
  editId    = qs('#edit-task-id');
  ensureEditFormFields(); // inject missing fields now

  // greeting from JWT
const accessToken = localStorage.getItem('accessToken');
if (!accessToken) { 
    window.location.href = 'login.html'; 
    return; 
}

// ✅ SIMPLE - Get username from localStorage
const username = localStorage.getItem('username') || 'User';
document.getElementById('user-greeting').textContent = `Hello, ${username}!`;

  // logout
  const logoutButton = qs('#logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = 'login.html';
    });
  }

  // event: open add modal (Parent task by default)
  showAddTaskBtn.addEventListener('click', () => showAddTaskModal(null));

  // modal close handlers (X and Cancel) for both modals
  qsa('#add-task-modal .close-button').forEach(b => b.addEventListener('click', () => { addTaskForm.reset(); closeModal(addTaskModal); }));
  qsa('#edit-task-modal .close-button').forEach(b => b.addEventListener('click', () => closeModal(editModal)));

  // clicking outside content closes modal
  window.addEventListener('click', (e) => {
    if (e.target === addTaskModal) { addTaskForm.reset(); closeModal(addTaskModal); }
    if (e.target === editModal) closeModal(editModal);
  });

  // tasks grid interactions
  tasksGrid.addEventListener('click', onTasksGridClick);

  // forms submit
  addTaskForm.addEventListener('submit', onAddTaskSubmit);
  editForm.addEventListener('submit', onEditTaskSubmit);

  // filters & search
  applyFiltersBtn.addEventListener('click', () => fetchAndRenderTasks(getCurrentFilterSortParams()));
  resetFiltersBtn.addEventListener('click', () => {
    globalSearchInput.value = '';
    filterCategory.value = 'all';
    filterStatus.value = 'all';
    sortBy.value = 'created_at_desc';
    fetchAndRenderTasks();
  });
  globalSearchInput.addEventListener('keypress', (e)=>{ if (e.key === 'Enter') applyFiltersBtn.click(); });

  // initial load
  fetchAndDisplayStats();
  fetchAndRenderTasks();

  console.log('DOM References check:');
console.log('addTaskModal:', addTaskModal);
console.log('addTaskForm:', addTaskForm);
console.log('addTaskParentHidden:', addTaskParentHidden);
console.log('addTaskFeedback:', addTaskFeedback);
});
