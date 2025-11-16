import { Link } from "react-router-dom";

export default function Navbar({ 
  type = "public",
  username = "",
  userProfilePic = "",
  searchValue = "",
  onSearchChange = () => {},
  onSearchKeyPress = () => {},
  onAddTask = () => {},
  onLogout = () => {}
}) {
  
  if (type === "tasks") {
    return (
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
                  value={searchValue}
                  onChange={onSearchChange}
                  onKeyPress={onSearchKeyPress}
                />
              </li>
              <li className="nav-item">
                <button
                  id="show-add-task-form-button"
                  className="button navbar-add-button"
                  onClick={onAddTask}
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
                <a 
                  href="#" 
                  id="logout-button" 
                  className="button" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    onLogout(); 
                  }}
                >
                  Logout
                </a>
              </li>
              <li className="nav-item">
                <Link to="/profile">
                  <img src={userProfilePic || "https://res.cloudinary.com/dciud6yuq/image/upload/v1744963258/pfp_kniw7o.jpg"}
                    alt="Profile" className="navbar-profile-pic"
                  />
              </Link>
            </li>
            </ul>
          </div>
        </nav>
      </header>
    );
  }
  
  return (
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
  );
}