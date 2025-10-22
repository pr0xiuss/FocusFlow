import "../styles/style.css";
import { Link } from "react-router-dom";
import { useEffect } from "react";

export default function Index() {
  useEffect(() => {
    const links = document.querySelectorAll('a[href^="#"]');
    const handleClick = (e) => {
      e.preventDefault();
      const target = document.querySelector(e.target.getAttribute("href"));
      target?.scrollIntoView({ behavior: "smooth" });
    };
    links.forEach((link) => link.addEventListener("click", handleClick));
    return () => links.forEach((link) => link.removeEventListener("click", handleClick));
  }, []);

  return (
    <div>
      <header>
        <nav className="navbar">
          <div className="container navbar-content">
            <a href="/" className="navbar-brand">FocusFlow</a>
            <ul className="navbar-nav">
              <li><a href="#features-section" className="nav-link">About Us</a></li>
              <li><a href="#contact-section" className="nav-link">Contact Us</a></li>
              <li><Link to="/login" className="button">Login</Link></li>
              <li><Link to="/signup" className="button">Sign Up</Link></li>
            </ul>
          </div>
        </nav>
      </header>

      <main>
        <section className="hero container">
          <h1>Organize Your Life with FocusFlow</h1>
          <p>
            Manage your tasks, set due dates, categorize, and conquer your goals with ease.
            Designed for clarity and productivity.
          </p>
          <div className="hero-actions">
            <Link to="/signup" className="button">Get Started Now</Link>
            <Link to="/login" className="button">Already a User? Login</Link>
          </div>
        </section>

        <section id="features-section" className="features container">
          <h2>Key Features</h2>
          <div className="feature-grid">
            <div className="feature-item">
              <h3>Hierarchical &amp; Scalable Tasks</h3>
              <p>
                Break down grand objectives into granular subtasks, effortlessly managing
                complex projects with arbitrary depth. Designed for clarity and massive scalability.
              </p>
            </div>
            <div className="feature-item">
              <h3>Smart Due Dates &amp; Categories</h3>
              <p>
                Leverage precise due dates and custom categories to prioritize and organize.
                Never miss a critical deadline, ensuring consistent progress on your goals.
              </p>
            </div>
            <div className="feature-item">
              <h3>Dynamic Search &amp; Filtering</h3>
              <p>
                Instantly locate any task using powerful search and advanced filtering options
                across all task properties. Find exactly what you need, when you need it.
              </p>
            </div>
            <div className="feature-item">
              <h3>Secure Multi-User Experience</h3>
              <p>
                Your tasks are securely isolated and accessible only by you. Our robust authentication
                ensures privacy, allowing multiple users to manage their distinct task ecosystems.
              </p>
            </div>
          </div>
        </section>

        <section id="contact-section" className="contact container">
          <h2>Contact Us</h2>
          <p className="contact-intro">
            Have questions, feedback, or need support? Reach out to us!
          </p>
          <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
            <div className="form-group">
              <label htmlFor="contact-name">Your Name</label>
              <input type="text" id="contact-name" name="name" required />
            </div>
            <div className="form-group">
              <label htmlFor="contact-email">Your Email</label>
              <input type="email" id="contact-email" name="email" required />
            </div>
            <div className="form-group">
              <label htmlFor="contact-subject">Subject</label>
              <input type="text" id="contact-subject" name="subject" required />
            </div>
            <div className="form-group">
              <label htmlFor="contact-message">Message</label>
              <textarea id="contact-message" name="message" rows="5" required></textarea>
            </div>
            <button type="submit" className="button">Send Message</button>
          </form>
          <p className="contact-email-info">
            You can also directly email us at:{" "}
            <a href="mailto:proxius31@gmail.com">proxius31@gmail.com</a>
          </p>
        </section>
      </main>

      <footer>
        <div className="container">
          <p>&copy; 2025 FocusFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
