import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "../styles/auth.css";
import "../styles/style.css";

export default function Signup() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [feedback, setFeedback] = useState("");

  const API_BASE_URL = "http://127.0.0.1:8000/api";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback("");

    if (!username || !password || !password2) {
      setFeedback("Please fill in all required fields.");
      return;
    }

    if (password !== password2) {
      setFeedback("Passwords do not match.");
      return;
    }

    const userData = { username, email, pwd: password, pwd2: password2 };

    try {
      const response = await fetch(`${API_BASE_URL}/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Registration successful:", data);

        localStorage.setItem("username", username);
        setFeedback("Registration successful! Redirecting to login...");

        setUsername("");
        setEmail("");
        setPassword("");
        setPassword2("");

        setTimeout(() => {
          navigate("/login");
        }, 1000);
      } else {
        const errorData = await response.json();
        console.error("Registration failed:", errorData);

        if (errorData.username) setFeedback(`Username: ${errorData.username[0]}`);
        else if (errorData.email) setFeedback(`Email: ${errorData.email[0]}`);
        else if (errorData.pwd) setFeedback(`Password: ${errorData.pwd[0]}`);
        else if (errorData.detail) setFeedback(errorData.detail);
        else setFeedback("Registration failed. Please try again.");
      }
    } catch (error) {
      console.error("Network error during registration:", error);
      setFeedback("Network error. Please check your connection or server status.");
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
            <h1>Create an Account!</h1>
            <p className="auth-intro-text">
              Join FocusFlow and start organizing your tasks.
            </p>

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
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  placeholder="Enter your email (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group password-group">
                <label htmlFor="password">Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <span
                    className="password-toggle-icon"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FaEye />:<FaEyeSlash />}
                  </span>
                </div>
              </div>

              <div className="form-group password-group">
                <label htmlFor="password2">Confirm Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword2 ? "text" : "password"}
                    id="password2"
                    placeholder="Confirm your password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    required
                  />
                  <span
                    className="password-toggle-icon"
                    onClick={() => setShowPassword2(!showPassword2)}
                  >
                    {showPassword2 ? <FaEye />:<FaEyeSlash />}
                  </span>
                </div>
              </div>

              <button type="submit" className="button auth-button">
                Sign Up
              </button>
            </form>

            <p className="auth-switch-text">
              Already have an account?{" "}
              <Link to="/login" className="auth-switch-link">
                Log In
              </Link>
            </p>
          </div>
        </div>

        <div className="auth-illustration-panel">
          <p className="auth-illustration-text">
            Get started organizing your goals and boosting productivity with FocusFlow.
          </p>
        </div>
      </div>
    </div>
  );
}
