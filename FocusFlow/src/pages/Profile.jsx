import { useState, useEffect } from "react";
import "../styles/style.css";
import "../styles/tasks.css";
import "../styles/profile.css";

const API_BASE_URL = "http://127.0.0.1:8000/api";

// Auth fetch helper
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
  if (["POST", "PUT", "PATCH","DELETE"].includes(method) && !opts.headers["Content-Type"]) {
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

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    total_tasks: 0,
    pending_tasks: 0,
    completed_tasks: 0,
    overdue_tasks: 0,
  });
  const [recentActivity, setRecentActivity] = useState({
    recently_completed: [],
    recently_created: [],
  });
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showEditPicModal, setShowEditPicModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);

  const username = localStorage.getItem("username") || "User";

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const [profileRes, statsRes, activityRes] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/profile/`),
        authenticatedFetch(`${API_BASE_URL}/tasks/stats/`),
        authenticatedFetch(`${API_BASE_URL}/profile/recent-activity/`),
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setRecentActivity(activityData);
      }
    } catch (err) {
      console.error("Error fetching profile data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("username");
    window.location.href = "/";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const formatMemberSince = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div style={{ padding: "20px", textAlign: "center", backgroundColor: "#f7f9fc" }}>
          <a href="/tasks" className="button" style={{ display: "inline-block" }}>
            ← Back to Tasks
          </a>
        </div>
        <main className="container" style={{ flex: "1" }}>
          <p className="loading-message">Loading profile...</p>
        </main>
        <footer>
          <div className="container">
            <p>&copy; 2025 FocusFlow. All rights reserved.</p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Back to Tasks Link */}
      <div style={{ padding: "20px", textAlign: "center", backgroundColor: "#f7f9fc" }}>
        <a href="/tasks" className="button" style={{ display: "inline-block" }}>
          ← Back to Tasks
        </a>
      </div>

      <main className="container profile-container" style={{ flex: "1" }}>
        {/* Profile Header Section */}
        <section className="profile-header-section">
          <div className="profile-pic-container">
            <img src={profile?.profile_picture || "https://res.cloudinary.com/dciud6yuq/image/upload/v1744963258/pfp_kniw7o.jpg"}
             alt="Profile"
            className="profile-picture"
            />
            <button
              className="button secondary edit-pic-button"
              onClick={() => setShowEditPicModal(true)}
            >
              Edit Picture
            </button>
          </div>

          <div className="profile-info">
            <h1 className="profile-username">{profile?.username || username}</h1>
            <p className="profile-email">{profile?.email || "No email provided"}</p>
            <p className="profile-member-since">
              Member since {formatMemberSince(profile?.member_since)}
            </p>
          </div>
        </section>

        {/* Task Statistics Section */}
        <section className="stats-cards-section">
          <h2>Task Statistics</h2>
          <div className="stats-grid">
            <div className="stat-card" id="total-tasks-card">
              <div className="stat-icon">📈</div>
              <div className="stat-info">
                <div className="stat-value">{stats.total_tasks}</div>
                <div className="stat-label">Total Tasks</div>
              </div>
            </div>
            <div className="stat-card" id="pending-tasks-card">
              <div className="stat-icon">⏳</div>
              <div className="stat-info">
                <div className="stat-value">{stats.pending_tasks}</div>
                <div className="stat-label">Pending</div>
              </div>
            </div>
            <div className="stat-card" id="completed-tasks-card">
              <div className="stat-icon">✅</div>
              <div className="stat-info">
                <div className="stat-value">{stats.completed_tasks}</div>
                <div className="stat-label">Completed</div>
              </div>
            </div>
            <div className="stat-card" id="overdue-tasks-card">
              <div className="stat-icon">🚨</div>
              <div className="stat-info">
                <div className="stat-value">{stats.overdue_tasks}</div>
                <div className="stat-label">Overdue</div>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Activity Section */}
        <section className="recent-activity-section">
          <h2>Recent Activity</h2>
          
          <div className="activity-group">
            <h3>Recently Completed</h3>
            {recentActivity.recently_completed.length > 0 ? (
              <ul className="activity-list">
                {recentActivity.recently_completed.map((task) => (
                  <li key={task.id} className="activity-item completed">
                    <span className="activity-icon">✅</span>
                    <span className="activity-text">{task.title}</span>
                    <span className="activity-time">
                      {formatDate(task.updated_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-activity">No recently completed tasks</p>
            )}
          </div>

          <div className="activity-group">
            <h3>Recently Created</h3>
            {recentActivity.recently_created.length > 0 ? (
              <ul className="activity-list">
                {recentActivity.recently_created.map((task) => (
                  <li key={task.id} className="activity-item created">
                    <span className="activity-icon">📝</span>
                    <span className="activity-text">{task.title}</span>
                    <span className="activity-time">
                      {formatDate(task.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-activity">No recently created tasks</p>
            )}
          </div>
        </section>

        {/* Settings Section */}
        <section className="settings-section">
          <h2>Settings</h2>
          <button
            className="button settings-button"
            onClick={() => setShowChangePasswordModal(true)}
          >
            🔒 Change Password
          </button>
        </section>

        {/* Account Actions Section */}
        <section className="account-actions-section">
          <h2>Account Actions</h2>
          <div className="account-actions-buttons">
            <button className="button" onClick={handleLogout}>
              🚪 Logout
            </button>
            <button
              className="button danger-button"
              onClick={() => setShowDeleteAccountModal(true)}
            >
              🗑️ Delete Account
            </button>
          </div>
        </section>
      </main>

      <footer>
        <div className="container">
          <p>&copy; 2025 FocusFlow. All rights reserved.</p>
        </div>
      </footer>

      {/* Modals */}
      <EditPictureModal
        show={showEditPicModal}
        onClose={() => setShowEditPicModal(false)}
        onSuccess={fetchProfileData}
      />

      <ChangePasswordModal
        show={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />

      <DeleteAccountModal
        show={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
      />
    </div>
  );
}


/* ============ MODAL COMPONENTS ============ */

// Edit Picture Modal
function EditPictureModal({ show, onClose, onSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (show) {
      document.body.classList.add("modal-open");
      setSelectedFile(null);
      setPreviewUrl(null);
      setFeedback("");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [show]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      setFeedback("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFeedback("Image size should be less than 5MB");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
    setFeedback("");
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setFeedback("Please select an image first");
      return;
    }

    setUploading(true);
    setFeedback("");

    try {
      const formData = new FormData();
      formData.append("profile_picture", selectedFile);

      const accessToken = localStorage.getItem("accessToken");
      const res = await fetch(`${API_BASE_URL}/profile/`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (res.ok) {
        setFeedback("Profile picture updated successfully!");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        const error = await res.json();
        setFeedback(error.detail || "Failed to upload image");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setFeedback("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal" style={{ display: "flex" }} onClick={onClose}>
      <div className="modal-content profile-modal-content" onClick={(e) => e.stopPropagation()}>
        <span className="close-button" onClick={onClose}>
          &times;
        </span>
        <h3>Edit Profile Picture</h3>

        {!previewUrl ? (
          <div
            className={`upload-area ${dragOver ? "drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input").click()}
          >
            <div className="upload-icon">📸</div>
            <p className="upload-text">Click to upload or drag and drop</p>
            <p className="upload-hint">PNG, JPG, GIF up to 5MB</p>
            <input
              id="file-input"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="file-input"
            />
          </div>
        ) : (
          <div className="preview-container">
            <img src={previewUrl} alt="Preview" className="preview-image" />
            <button
              className="button secondary change-image-button"
              onClick={() => {
                setPreviewUrl(null);
                setSelectedFile(null);
              }}
            >
              Change Image
            </button>
          </div>
        )}

        {feedback && (
          <p
            className="feedback-message"
            style={{
              color: feedback.includes("success") ? "#28a745" : "#dc3545",
              textAlign: "center",
              margin: "15px 0",
            }}
          >
            {feedback}
          </p>
        )}

        <div className="form-actions">
          <button
            className="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? "Uploading..." : "Upload Picture"}
          </button>
          <button className="button secondary" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}


// Change Password Modal
function ChangePasswordModal({ show, onClose }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show) {
      document.body.classList.add("modal-open");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback("");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [show]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback("");

    // Validation
    if (!oldPassword || !newPassword || !confirmPassword) {
      setFeedback("All fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback("New passwords don't match");
      return;
    }

    if (newPassword.length < 6) {
      setFeedback("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    try {
      const accessToken = localStorage.getItem("accessToken");
      const res = await fetch(`${API_BASE_URL}/profile/change-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      if (res.ok) {
        setFeedback("Password changed successfully!");
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        const error = await res.json();
        setFeedback(error.error || error.detail || "Failed to change password");
      }
    } catch (err) {
      console.error("Password change error:", err);
      setFeedback("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal" style={{ display: "flex" }} onClick={onClose}>
      <div className="modal-content profile-modal-content" onClick={(e) => e.stopPropagation()}>
        <span className="close-button" onClick={onClose}>
          &times;
        </span>
        <h3>Change Password</h3>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="old-password">Current Password</label>
            <input
              type="password"
              id="old-password"
              placeholder="Enter current password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-password">New Password</label>
            <input
              type="password"
              id="new-password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">Confirm New Password</label>
            <input
              type="password"
              id="confirm-password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {feedback && (
            <p
              className="feedback-message"
              style={{
                color: feedback.includes("success") ? "#28a745" : "#dc3545",
                textAlign: "center",
                margin: "15px 0",
              }}
            >
              {feedback}
            </p>
          )}

          <div className="form-actions">
            <button type="submit" className="button" disabled={loading}>
              {loading ? "Changing..." : "Change Password"}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// Delete Account Modal
function DeleteAccountModal({ show, onClose }) {
  const [confirmText, setConfirmText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show) {
      document.body.classList.add("modal-open");
      setConfirmText("");
      setFeedback("");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [show]);

  const handleDelete = async () => {
    const username = localStorage.getItem("username");

    if (confirmText !== username) {
      setFeedback(`Please type "${username}" to confirm`);
      return;
    }

    setLoading(true);
    setFeedback("");

    try {
      const accessToken = localStorage.getItem("accessToken");
      const res = await fetch(`${API_BASE_URL}/profile/delete-account/`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.ok) {
        setFeedback("Account deleted successfully. Redirecting...");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("username");

        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      } else {
        const error = await res.json();
        setFeedback(error.detail || "Failed to delete account");
        setLoading(false);
      }
    } catch (err) {
      console.error("Delete account error:", err);
      setFeedback("Network error. Please try again.");
      setLoading(false);
    }
  };

  if (!show) return null;

  const username = localStorage.getItem("username");

  return (
    <div className="modal" style={{ display: "flex" }} onClick={onClose}>
      <div className="modal-content profile-modal-content" onClick={(e) => e.stopPropagation()}>
        <span className="close-button" onClick={onClose}>
          &times;
        </span>
        <h3>Delete Account</h3>

        <div className="delete-confirmation">
          <p>⚠️ Warning: This action cannot be undone!</p>
          <p style={{ fontSize: "1em", marginTop: "10px" }}>
            All your tasks and data will be permanently deleted.
          </p>
          <p style={{ fontSize: "1em", marginTop: "15px", color: "#333" }}>
            Type <strong>{username}</strong> to confirm:
          </p>
          <input
            type="text"
            placeholder={`Type "${username}" here`}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </div>

        {feedback && (
          <p
            className="feedback-message"
            style={{
              color: feedback.includes("success") ? "#28a745" : "#dc3545",
              textAlign: "center",
              margin: "15px 0",
              fontWeight: "bold",
            }}
          >
            {feedback}
          </p>
        )}

        <div className="form-actions">
          <button
            className="button danger-button"
            onClick={handleDelete}
            disabled={loading || confirmText !== username}
          >
            {loading ? "Deleting..." : "Delete My Account"}
          </button>
          <button
            className="button secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
        </div>

        <p className="delete-warning">
          This will permanently delete your account and all associated data.
        </p>
      </div>
    </div>
  );
}