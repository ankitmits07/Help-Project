import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import ChatBox from "./ChatBox";

export default function ChatInterface({ requests, onSelectRequest }) {
  const { user } = useContext(AuthContext);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRequests = requests.filter(req => 
    req.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectRequest = (request) => {
    setSelectedRequest(request);
    onSelectRequest(request);
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const requestTime = new Date(date);
    const diffInMinutes = Math.floor((now - requestTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Groceries': '🛒',
      'Medical': '🏥',
      'Tech Help': '💻',
      'Emergency': '🚨',
      'Transport': '🚗',
      'Other': '❓'
    };
    return icons[category] || icons['Other'];
  };

  return (
    <div className="chat-interface">
      {/* Sidebar */}
      <div className="chat-sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <div className="user-profile">
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <h6>{user?.name}</h6>
              <small>Trust: {user?.trustPoints}</small>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-icon" title="New Request">
              ✏️
            </button>
            <button className="btn-icon" title="Menu">
              ⋮
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="search-container">
          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {/* Request List */}
        <div className="request-list">
          {filteredRequests.length === 0 ? (
            <div className="no-requests">
              <div className="no-requests-icon">📭</div>
              <p>No help requests found</p>
              <small>Create a new request to get started</small>
            </div>
          ) : (
            filteredRequests.map((request) => (
              <div
                key={request._id}
                className={`request-item ${selectedRequest?._id === request._id ? 'active' : ''}`}
                onClick={() => handleSelectRequest(request)}
              >
                <div className="request-avatar">
                  <div className="avatar-circle">
                    {request.user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="category-badge">
                    {getCategoryIcon(request.category)}
                  </div>
                </div>
                
                <div className="request-content">
                  <div className="request-header">
                    <h6 className="request-name">{request.user?.name}</h6>
                    <small className="request-time">
                      {getTimeAgo(request.createdAt)}
                    </small>
                  </div>
                  
                  <div className="request-preview">
                    <span className="category-tag">{request.category}</span>
                    <p className="description">{request.description}</p>
                  </div>
                  
                  <div className="request-status">
                    <span className={`status-badge ${request.status}`}>
                      {request.status === 'active' ? '🟢' : '🔴'} {request.status}
                    </span>
                    {request.helper && (
                      <small className="helper-info">
                        Helped by {request.helper.name}
                      </small>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-main">
        <ChatBox 
          requestId={selectedRequest?._id} 
          requestData={selectedRequest}
        />
      </div>
    </div>
  );
}