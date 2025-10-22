import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "../styles/auth.css";
import "../styles/style.css";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState("");

  const API_BASE_URL = "http://127.0.0.1:8000/api";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback("");
    if (!username || !password) {
      setFeedback("Please enter both username and password.");
      return;
    }

    const loginData = { username, password };

    try {
      const response = await fetch(`${API_BASE_URL}/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("username", username);
        localStorage.setItem("accessToken", data.access);
        localStorage.setItem("refreshToken", data.refresh);

        setFeedback("Login successful! Redirecting...");
        setUsername("");
        setPassword("");

        setTimeout(() => {
          navigate("/tasks");
        }, 1000);
      }else {
          setFeedback("Invalid username or password.");
      }
      
    } catch (error) {
      setFeedback("Network error. Serer is busy.");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form-panel">
          <div className="auth-header">
            <Link to="/">
              <img
                src="/FocusFlow-removebg-preview.png"
                alt="FocusFlow Logo"
                className="auth-logo"
              />
            </Link>
            <div className="auth-brand-text">FocusFlow</div>
          </div>

          <div className="auth-content">
            <h1>Welcome Back!</h1>
            <p className="auth-intro-text">Please enter login details below</p>

            {feedback && (
              <p
                className="feedback-message"
                style={{
                  color: feedback.includes("successful") ? "#28a745" : "#dc3545",
                  fontWeight: "bold",
                  marginTop: "15px",
                  marginBottom: "15px",
                }}
              >
                {feedback}
              </p>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group password-group">
                <label htmlFor="password">Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <span
                    className="password-toggle-icon"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FaEye />:<FaEyeSlash /> }
                  </span>
                </div>
              </div>

              <div className="forgot-password">
                <Link to="#" className="forgot-password-link">
                  Forgot password?
                </Link>
              </div>

              <button type="submit" className="button auth-button">
                Sign In
              </button>
            </form>

            <p className="auth-switch-text">
              Don't have an account?{" "}
              <Link to="/signup" className="auth-switch-link">
                Sign Up
              </Link>
            </p>
          </div>
        </div>

        <div className="auth-illustration-panel">
          <p className="auth-illustration-text">
            Manage your tasks in an easy and more efficient way with FocusFlow...
          </p>
        </div>
      </div>
    </div>
  );
}
