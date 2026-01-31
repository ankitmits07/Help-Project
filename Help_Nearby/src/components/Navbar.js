import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    // Load notifications from localStorage on component mount
    const loadStoredNotifications = () => {
      const stored = JSON.parse(localStorage.getItem('helpNotifications') || '[]');
      setNotifications(stored);
    };
    
    loadStoredNotifications();
    
    // Listen for notification updates from NotificationSystem
    const handleNotificationUpdate = (event) => {
      setNotifications(event.detail.notifications);
    };

    window.addEventListener('notificationUpdate', handleNotificationUpdate);
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (!event.target.closest('.notification-wrapper')) {
        setShowNotifications(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);

    // Listen for message notifications
    const handleMessageNotification = (event) => {
      if (event.detail.type === 'message') {
        setMessageCount(prev => prev + 1);
      }
    };

    window.addEventListener('messageNotification', handleMessageNotification);

    return () => {
      window.removeEventListener('notificationUpdate', handleNotificationUpdate);
      window.removeEventListener('messageNotification', handleMessageNotification);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle('dark-mode', !darkMode);
  };

  const toggleNotifications = (e) => {
    e.stopPropagation();
    setShowNotifications(!showNotifications);
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    localStorage.removeItem('helpNotifications');
    window.dispatchEvent(new CustomEvent('clearAllNotifications'));
  };

  return (
    <nav className={`modern-navbar ${darkMode ? 'dark' : ''}`}>
      <div className="navbar-container">
        {/* Logo */}
        <Link
          to={user ? "/dashboard" : "/"}
          className="navbar-logo"
        >
          <div className="logo-icon">
            <span className="logo-emoji">🤝</span>
          </div>
          <span className="logo-text">HelpNearby</span>
        </Link>

        {/* Center - Empty for cleaner look */}
        <div className="navbar-center">
        </div>

        {/* Right Actions */}
        <div className="navbar-actions">
          {!user ? (
            <>
              <Link to="/" className="nav-btn nav-btn-ghost">
                Sign In
              </Link>
              <Link to="/register" className="nav-btn nav-btn-primary">
                Get Started
              </Link>
            </>
          ) : (
            <>
              <Link to="/my-requests" className="nav-btn nav-btn-ghost" title="My Old Requests">
                📋 My Requests
              </Link>
              
              <button className="nav-btn nav-btn-icon" title="Messages" onClick={() => window.location.href = '/chat'}>
                💬
                {messageCount > 0 && (
                  <span className="notification-badge">{messageCount}</span>
                )}
              </button>
              
              <div className="notification-wrapper">
                <button 
                  className="nav-btn nav-btn-icon notification-btn" 
                  title="Notifications"
                  onClick={toggleNotifications}
                >
                  🔔
                  {notifications.length > 0 && (
                    <span className="notification-badge">{notifications.length}</span>
                  )}
                </button>
                
                {showNotifications && (
                  <div className="notification-dropdown">
                    <div className="notification-header">
                      <h6>Notifications</h6>
                      {notifications.length > 0 && (
                        <button 
                          className="btn-clear-all"
                          onClick={clearAllNotifications}
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="notification-list">
                      {notifications.length === 0 ? (
                        <div className="no-notifications">
                          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</div>
                          <p>No new notifications</p>
                          <small>You'll see notifications here when someone needs help nearby</small>
                        </div>
                      ) : (
                        notifications.slice(-5).map(notif => (
                          <div key={notif.id} className="notification-item">
                            <div className="notif-icon">{notif.icon}</div>
                            <div className="notif-content">
                              <div className="notif-title">{notif.title}</div>
                              <div className="notif-message">{notif.message}</div>
                              {notif.actions && (
                                <div className="notif-actions">
                                  {notif.actions.map((action, i) => (
                                    <button
                                      key={i}
                                      className={`notif-btn ${action.type}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        action.handler();
                                      }}
                                    >
                                      {action.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <button 
                className="nav-btn nav-btn-icon" 
                title="Toggle Dark Mode"
                onClick={toggleDarkMode}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
              <button
                onClick={handleLogout}
                className="nav-btn nav-btn-ghost"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
