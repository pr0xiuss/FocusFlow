import { useEffect, useState } from "react";
import "../styles/style.css";
import "../styles/tasks.css";

/* === BASE API === */
const API_BASE_URL = "http://127.0.0.1:8000/api";

/* === AUTH & FETCH HELPERS === */
async function authenticatedFetch(url, options = {}) {
  const accessToken = localStorage.getItem("accessToken");
  if (!accessToken) return { error: "Unauthorized" };

  const opts = {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  };

  const method = (opts.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH"].includes(method) && !opts.headers["Content-Type"]) {
    opts.headers["Content-Type"] = "application/json";
  }

  let res = await fetch(url, opts);
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return { error: "Session expired" };
    opts.headers["Authorization"] = `Bearer ${localStorage.getItem("accessToken")}`;
    res = await fetch(url, opts);
  }
  return res;
}

async function refreshAccessToken() {
  const refresh = localStorage.getItem("refreshToken");
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem("accessToken", data.access);
    return true;
  } catch {
    return false;
  }
}

/* === API WRAPPERS === */
async function apiGetTasks(params = {}) {
  const sp = new URLSearchParams();
  if (params.search) sp.append("search", params.search);
  if (params.category && params.category !== "all") sp.append("category", params.category);
  if (params.status && params.status !== "all") sp.append("completed", params.status);
  if (params.sortBy) {
    const parts = params.sortBy.split("_");
    if (parts.length === 2) {
      sp.append("sort_by", parts[0]);
      sp.append("order", parts[1]);
    }
  }

  const res = await authenticatedFetch(`${API_BASE_URL}/tasks/?${sp.toString()}`);
  if (!res || !res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

async function apiGetStats() {
  const res = await authenticatedFetch(`${API_BASE_URL}/tasks/stats/`);
  if (!res || !res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

async function apiGetTask(id) {
  const res = await authenticatedFetch(`${API_BASE_URL}/tasks/${id}/`);
  if (!res || !res.ok) throw new Error("Failed to fetch task");
  return res.json();
}

async function apiGetSubtasks(id) {
  const res = await authenticatedFetch(`${API_BASE_URL}/tasks/${id}/subtasks/`);
  if (!res || !res.ok) throw new Error("Failed to fetch subtasks");
  return res.json();
}

async function apiCreateTask(payload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/tasks/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res || !res.ok) {
    const data = await tryReadJSON(res);
    return { ok: false, data };
  }
  return { ok: true, data: await res.json() };
}

async function apiUpdateTask(id, payload, method = "PUT") {
  const res = await authenticatedFetch(`${API_BASE_URL}/tasks/${id}/`, {
    method,
    body: JSON.stringify(payload),
  });
  if (!res || !res.ok) {
    const data = await tryReadJSON(res);
    return { ok: false, data };
  }
  return { ok: true, data: await res.json() };
}

async function apiDeleteTask(id) {
  try {
    const res = await authenticatedFetch(`${API_BASE_URL}/tasks/${id}/`, {
      method: "DELETE",
    });

    if (!res) {
      console.error("No response from server");
      throw new Error("No response from server");
    }

    if (res.status === 204 || res.status === 200) {
      return true;
    }

    if (res.status === 500) {
      return true;
    }

    if (res.status >= 400 && res.status !== 404) {
      const errorData = await tryReadJSON(res);
      throw new Error(`Delete failed: ${res.status} ${errorData.detail || "Unknown error"}`);
    }

    return true;
  } catch (err) {
    console.error("Delete request failed:", err);
    return true;
  }
}

async function tryReadJSON(res) {
  try {
    return await res.json();
  } catch {
    return { detail: "Unknown error" };
  }
}

/* === UTILITIES === */
const formatDate = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const escapeHtml = (str = "") =>
  String(str).replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[m])
  );

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/* === TASK CARD COMPONENT === */
function TaskCard({
  task,
  depth = 0,
  onToggleExpand,
  onAddSubtask,
  onToggleComplete,
  onEdit,
  onDelete,
  expandedTasks,
  subtasksData,
}) {
  const t0 = todayStart();
  let isOverdue = false;
  if (task.due_date && !task.completed) {
    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    isOverdue = due < t0;
  }

  const isExpanded = expandedTasks[task.id];
  const subtasks = subtasksData[task.id] || [];

  return (
    <>
      <div
        className={`task-card depth-${depth} ${task.completed ? "completed" : ""}`}
        data-task-id={task.id}
        data-depth={depth}
      >
        <div className="card-header">
          <button
            className={`task-toggle ${isExpanded ? "expanded" : ""}`}
            onClick={() => onToggleExpand(task.id)}
            style={{ visibility: task.has_subtasks ? "visible" : "hidden" }}
          >
            {isExpanded ? "▼" : "▶"}
          </button>
          <h3 className="card-title">{escapeHtml(task.title)}</h3>
          <div className="card-status-info">
            {task.completed ? (
              <span className="tag completed">Completed</span>
            ) : isOverdue ? (
              <span className="tag overdue">Overdue</span>
            ) : (
              <span className="tag incomplete">Pending</span>
            )}
          </div>
        </div>
        <p className="card-description">
          {task.description ? escapeHtml(task.description) : "No description."}
        </p>
        <div className="card-footer">
          <div className="card-meta">
            <span>Due: {task.due_date ? formatDate(task.due_date) : "N/A"}</span>
            <span>Category: {escapeHtml(task.category || "None")}</span>
          </div>
          <div className="card-actions">
            <button
              className="add-subtask-button"
              onClick={() => onAddSubtask(task.id)}
              title="Add Subtask"
            >
              +
            </button>
            <button
              className="complete-toggle-button"
              onClick={() => onToggleComplete(task.id, task.completed)}
              title={task.completed ? "Mark Incomplete" : "Mark Completed"}
              dangerouslySetInnerHTML={{ __html: task.completed ? "&#x2714;" : "&#x2713;" }}
            />
            <button className="edit-button" onClick={() => onEdit(task.id)} title="Edit Task">
              ⚙️
            </button>
            <button className="delete-button" onClick={() => onDelete(task.id)} title="Delete Task">
              🗑️
            </button>
          </div>
        </div>
      </div>

      {task.has_subtasks && isExpanded && (
        <div className={`subtasks-wrapper depth-${depth}`} style={{ display: "block" }}>
          {subtasks.length > 0 ? (
            <div className="subtask-container">
              {subtasks.map((subtask) => (
                <TaskCard
                  key={subtask.id}
                  task={subtask}
                  depth={depth + 1}
                  onToggleExpand={onToggleExpand}
                  onAddSubtask={onAddSubtask}
                  onToggleComplete={onToggleComplete}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  expandedTasks={expandedTasks}
                  subtasksData={subtasksData}
                />
              ))}
            </div>
          ) : (
            <p className="no-subtasks-message">No subtasks.</p>
          )}
        </div>
      )}
    </>
  );
}

/* === ADD TASK MODAL === */
function AddTaskModal({ show, onClose, onSubmit, parentId }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (show) {
      setTitle("");
      setDescription("");
      setDueDate("");
      setCategory("");
      setFeedback("");
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [show]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setFeedback("Title is required.");
      return;
    }

    const payload = {
      title,
      description: description || null,
      due_date: dueDate || null,
      category: category || null,
      parent_task: parentId || null,
      completed: false,
    };

    const result = await onSubmit(payload);
    if (result) {
      setFeedback("");
      onClose();
    } else {
      setFeedback("Failed to add task. Please try again.");
    }
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setDueDate("");
    setCategory("");
    setFeedback("");
    onClose();
  };

  if (!show) return null;

  return (
    <div className="modal" style={{ display: "flex" }} onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <span className="close-button" onClick={handleClose}>
          &times;
        </span>
        <h3>Add Task</h3>
        <form id="add-task-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="new-task-title">Task Title</label>
            <input
              type="text"
              id="new-task-title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Prepare project report"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-task-description">Description (Optional)</label>
            <textarea
              id="new-task-description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="new-task-due-date">Due Date (Optional)</label>
              <input
                type="date"
                id="new-task-due-date"
                name="due_date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-task-category">Category (Optional)</label>
              <select
                id="new-task-category"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select Category</option>
                <option value="work">Work</option>
                <option value="personal">Personal</option>
                <option value="shopping">Shopping</option>
                <option value="home">Home</option>
                <option value="study">Study</option>
              </select>
            </div>
          </div>

          <div id="add-task-feedback" className="feedback-message" style={{ minHeight: "20px", margin: "10px 0" }}>
            {feedback && <span style={{ color: "#dc3545" }}>{feedback}</span>}
          </div>

          <div className="form-actions">
            <button type="submit" className="button">
              Add Task
            </button>
            <button type="button" className="button secondary close-button" onClick={handleClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* === EDIT TASK MODAL === */
function EditTaskModal({ show, task, onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setDueDate(formatDate(task.due_date) || "");
      setCategory(task.category || "");
      setFeedback("");
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [task]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setFeedback("Title is required.");
      return;
    }

    const payload = {
      title,
      description: description || null,
      due_date: dueDate || null,
      category: category || null,
    };

    const result = await onSubmit(task.id, payload);
    if (result) {
      setFeedback("");
      onClose();
    } else {
      setFeedback("Failed to update task. Please try again.");
    }
  };

  if (!show || !task) return null;

  return (
    <div className="modal" style={{ display: "flex" }} onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <span className="close-button" onClick={onClose}>
          &times;
        </span>
        <h3>Edit Task</h3>
        <form id="edit-task-form" onSubmit={handleSubmit}>
          <input type="hidden" id="edit-task-id" value={task.id} />
          
          <div className="form-group">
            <label htmlFor="edit-task-title">Task Title</label>
            <input
              type="text"
              id="edit-task-title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-task-description">Description (Optional)</label>
            <textarea
              id="edit-task-description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="edit-task-due-date">Due Date (Optional)</label>
              <input
                type="date"
                id="edit-task-due-date"
                name="due_date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-task-category">Category (Optional)</label>
              <select
                id="edit-task-category"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select Category</option>
                <option value="work">Work</option>
                <option value="personal">Personal</option>
                <option value="shopping">Shopping</option>
                <option value="home">Home</option>
                <option value="study">Study</option>
              </select>
            </div>
          </div>

          <div className="form-group feedback-area">
            <p id="edit-task-feedback" className="feedback-message" style={{ minHeight: "20px", margin: "10px 0" }}>
              {feedback && <span style={{ color: "#dc3545" }}>{feedback}</span>}
            </p>
          </div>

          <div className="form-actions">
            <button type="submit" className="button">
              Save Changes
            </button>
            <button type="button" className="button secondary close-button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* === MAIN TASKS COMPONENT === */
export default function Tasks() {
  // State
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({
    total_tasks: 0,
    pending_tasks: 0,
    completed_tasks: 0,
    overdue_tasks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    category: "all",
    status: "all",
    sortBy: "created_at_desc",
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [parentIdForAdd, setParentIdForAdd] = useState(null);

  const [expandedTasks, setExpandedTasks] = useState({});
  const [subtasksData, setSubtasksData] = useState({});

  const username = localStorage.getItem("username") || "User";

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      window.location.href = "login.html";
      return;
    }
  }, []);

  // Fetch initial data
  useEffect(() => {
    fetchTasksAndStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTasksAndStats = async (filterParams = null) => {
    setLoading(true);
    try {
      const paramsToUse = filterParams || filters;
      const [tasksData, statsData] = await Promise.all([
        apiGetTasks(paramsToUse),
        apiGetStats(),
      ]);
      setTasks(tasksData);
      setStats(statsData);
      
      // Re-fetch subtasks for all expanded tasks
      const expandedTaskIds = Object.keys(expandedTasks).filter(
        (taskId) => expandedTasks[taskId] === true
      );
      
      if (expandedTaskIds.length > 0) {
        const subtaskPromises = expandedTaskIds.map(async (taskId) => {
          try {
            const subtasks = await apiGetSubtasks(taskId);
            return { taskId, subtasks };
          } catch (err) {
            console.error(`Error fetching subtasks for task ${taskId}:`, err);
            return { taskId, subtasks: [] };
          }
        });
        
        const subtaskResults = await Promise.all(subtaskPromises);
        const newSubtasksData = {};
        subtaskResults.forEach(({ taskId, subtasks }) => {
          newSubtasksData[taskId] = subtasks;
        });
        setSubtasksData(newSubtasksData);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = async () => {
    setLoading(true);
    try {
      const tasksData = await apiGetTasks(filters);
      setTasks(tasksData);
    } catch (err) {
      console.error("Error applying filters:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = async () => {
    const resetFilters = {
      search: "",
      category: "all",
      status: "all",
      sortBy: "created_at_desc",
    };
    setFilters(resetFilters);
    setLoading(true);
    try {
      const tasksData = await apiGetTasks(resetFilters);
      setTasks(tasksData);
    } catch (err) {
      console.error("Error resetting filters:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (payload) => {
    try {
      const result = await apiCreateTask(payload);
      if (result.ok) {
        // Force immediate re-fetch with current filters
        await fetchTasksAndStats(filters);
        return true;
      } else {
        const data = result.data || {};
        const msg = data.detail || Object.values(data)[0] || "Failed to add";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
        return false;
      }
    } catch (err) {
      console.error("Error adding task:", err);
      alert("Network error");
      return false;
    }
  };

  const handleEditTask = async (id, payload) => {
    try {
      const result = await apiUpdateTask(id, payload, "PUT");
      if (result.ok) {
        // Force immediate re-fetch with current filters
        await fetchTasksAndStats(filters);
        return true;
      } else {
        const data = result.data || {};
        const msg = data.detail || Object.values(data)[0] || "Failed to update";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
        return false;
      }
    } catch (err) {
      console.error("Error updating task:", err);
      alert("Network error");
      return false;
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    try {
      const success = await apiDeleteTask(id);
      if (success) {
        // Force immediate re-fetch with current filters
        await fetchTasksAndStats(filters);
      } else {
        alert("Failed to delete task.");
      }
    } catch (err) {
      console.error("Error deleting task:", err);
      alert("Failed to delete task: " + err.message);
    }
  };

  const handleToggleComplete = async (id, currentCompleted) => {
    try {
      const result = await apiUpdateTask(id, { completed: !currentCompleted }, "PATCH");
      if (result.ok) {
        // Force immediate re-fetch with current filters
        await fetchTasksAndStats(filters);
      } else {
        const data = result.data || {};
        const msg = data.detail || data.completed || Object.values(data)[0] || "Update failed";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
      }
    } catch (err) {
      console.error("Error toggling completion:", err);
      alert("Failed to update status");
    }
  };

  const handleToggleExpand = async (taskId) => {
    if (expandedTasks[taskId]) {
      // Collapse
      setExpandedTasks((prev) => ({ ...prev, [taskId]: false }));
      setSubtasksData((prev) => {
        const newData = { ...prev };
        delete newData[taskId];
        return newData;
      });
    } else {
      // Expand - fetch subtasks
      setExpandedTasks((prev) => ({ ...prev, [taskId]: true }));
      try {
        const subtasks = await apiGetSubtasks(taskId);
        setSubtasksData((prev) => ({ ...prev, [taskId]: subtasks }));
      } catch (err) {
        console.error("Error loading subtasks:", err);
        setSubtasksData((prev) => ({ ...prev, [taskId]: [] }));
      }
    }
  };

  const handleOpenAddModal = (parentId = null) => {
    setParentIdForAdd(parentId);
    setShowAddModal(true);
  };

  const handleOpenEditModal = async (taskId) => {
    try {
      const task = await apiGetTask(taskId);
      setEditingTask(task);
      setShowEditModal(true);
    } catch (err) {
      console.error("Error loading task:", err);
      alert("Could not load task");
    }
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setParentIdForAdd(null);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingTask(null);
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("username");
    window.location.href = "/";
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === "Enter") {
      handleApplyFilters();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* NAVBAR */}
      <header>
        <nav className="navbar">
          <div className="container navbar-content">
            <span className="navbar-brand">FocusFlow</span>
            <ul className="navbar-nav">
              <li className="nav-item nav-search-add">
                <input
                  type="text"
                  id="global-search-tasks"
                  placeholder="Search tasks..."
                  className="navbar-search-input"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  onKeyPress={handleSearchKeyPress}
                />
              </li>
              <li className="nav-item">
                <button
                  id="show-add-task-form-button"
                  className="button navbar-add-button"
                  onClick={() => handleOpenAddModal(null)}
                >
                  Add Task
                </button>
              </li>
              <li className="nav-item">
                <span
                  id="user-greeting"
                  className="nav-link"
                  style={{ color: "white", cursor: "default" }}
                >
                  Hello, {username}!
                </span>
              </li>
              <li className="nav-item">
                <a href="#" id="logout-button" className="button" onClick={(e) => { e.preventDefault(); handleLogout(); }}>
                  Logout
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </header>

      <main className="container" style={{ flex: '1' }}>
        {/* STATS CARDS */}
        <section className="stats-cards-section">
          <div className="stats-grid">
            <div className="stat-card" id="total-tasks-card">
              <div className="stat-icon">📈</div>
              <div className="stat-info">
                <div className="stat-value" id="stat-total-tasks">
                  {stats.total_tasks}
                </div>
                <div className="stat-label">Total Tasks</div>
              </div>
            </div>
            <div className="stat-card" id="pending-tasks-card">
              <div className="stat-icon">⏳</div>
              <div className="stat-info">
                <div className="stat-value" id="stat-pending-tasks">
                  {stats.pending_tasks}
                </div>
                <div className="stat-label">Pending</div>
              </div>
            </div>
            <div className="stat-card" id="completed-tasks-card">
              <div className="stat-icon">✅</div>
              <div className="stat-info">
                <div className="stat-value" id="stat-completed-tasks">
                  {stats.completed_tasks}
                </div>
                <div className="stat-label">Completed</div>
              </div>
            </div>
            <div className="stat-card" id="overdue-tasks-card">
              <div className="stat-icon">🚨</div>
              <div className="stat-info">
                <div className="stat-value" id="stat-overdue-tasks">
                  {stats.overdue_tasks}
                </div>
                <div className="stat-label">Overdue</div>
              </div>
            </div>
          </div>
        </section>

        {/* FILTERS & SORT */}
        <section className="filters-sort-section">
          <div className="filters-sort-controls">
            <div className="form-group">
              <label htmlFor="filter-category">Category:</label>
              <select
                id="filter-category"
                value={filters.category}
                onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
              >
                <option value="all">All Categories</option>
                <option value="work">Work</option>
                <option value="personal">Personal</option>
                <option value="shopping">Shopping</option>
                <option value="home">Home</option>
                <option value="study">Study</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="filter-status">Status:</label>
              <select
                id="filter-status"
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="all">All Statuses</option>
                <option value="false">Incomplete</option>
                <option value="true">Completed</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="sort-by">Sort by:</label>
              <select
                id="sort-by"
                value={filters.sortBy}
                onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value }))}
              >
                <option value="created_at_desc">Newest First</option>
                <option value="title_asc">Title (A-Z)</option>
                <option value="title_desc">Title (Z-A)</option>
                <option value="due_date_asc">Due Date (Earliest)</option>
                <option value="due_date_desc">Due Date (Latest)</option>
                <option value="completed_asc">Incomplete First</option>
                <option value="completed_desc">Completed First</option>
                <option value="category_asc">Category (A-Z)</option>
                <option value="category_desc">Category (Z-A)</option>
              </select>
            </div>
            <button id="apply-filters-sort" className="button" onClick={handleApplyFilters}>
              Apply
            </button>
            <button id="reset-filters-sort" className="button secondary" onClick={handleResetFilters}>
              Reset
            </button>
          </div>
        </section>

        {/* TASK LIST */}
        <section id="task-list-section">
          <div className="task-grid-container">
            {loading ? (
              <p className="loading-message">Loading tasks...</p>
            ) : tasks.length === 0 ? (
              <p id="no-tasks-message" style={{ display: "block" }}>
                You haven't added any tasks yet. Use the button above to get started!
              </p>
            ) : (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  depth={0}
                  onToggleExpand={handleToggleExpand}
                  onAddSubtask={handleOpenAddModal}
                  onToggleComplete={handleToggleComplete}
                  onEdit={handleOpenEditModal}
                  onDelete={handleDeleteTask}
                  expandedTasks={expandedTasks}
                  subtasksData={subtasksData}
                />
              ))
            )}
          </div>
        </section>
      </main>

      <footer>
        <div className="container">
          <p>&copy; 2025 FocusFlow. All rights reserved.</p>
        </div>
      </footer>

      {/* MODALS */}
      <AddTaskModal
        show={showAddModal}
        onClose={handleCloseAddModal}
        onSubmit={handleAddTask}
        parentId={parentIdForAdd}
      />

      <EditTaskModal
        show={showEditModal}
        task={editingTask}
        onClose={handleCloseEditModal}
        onSubmit={handleEditTask}
      />
    </div>
  );
}