import { useEffect, useState, useContext } from "react";
import API from "../api/api";
import { AuthContext } from "../context/AuthContext";
import ChatBox from "../components/ChatBox";
import CreateRequestModal from "../components/CreateRequestModal";
import socket from "../socket";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "../styles/app.css";

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [acceptedRequests, setAcceptedRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [watchId, setWatchId] = useState(null);
  const [show24Hours, setShow24Hours] = useState(false);
  const [showMyRequests, setShowMyRequests] = useState(true);
  const [showNearbyRequests, setShowNearbyRequests] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    // Connect user to socket
    socket.emit('userConnect', { userId: user._id, userName: user.name });
    
    fetchNearby();
    fetchAcceptedRequests();
    
    // Get user location for real-time tracking
    navigator.geolocation.getCurrentPosition((pos) => {
      setUserLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      });
    });
    
    // Listen for new requests (instant notification)
    socket.on("newRequestCreated", (data) => {
      console.log('New request received:', data);
      fetchNearby();
      
      // Show instant notification for other users
      if (data.userId !== user._id) {
        window.dispatchEvent(new CustomEvent('newNotification', {
          detail: {
            id: Date.now(),
            type: 'request',
            title: 'New Help Request Nearby',
            message: `${data.userName} needs help with ${data.category}`,
            icon: '🆘'
          }
        }));
      }
    });

    // Listen for request updates
    socket.on("requestAccepted", (data) => {
      console.log('Request accepted:', data);
      fetchNearby();
      fetchAcceptedRequests();
      if (selected && selected._id === data.requestId) {
        setSelected(prev => ({ ...prev, status: 'accepted', helper: { _id: data.helperId, name: data.helperName } }));
      }
    });

    // Listen for notifications
    socket.on("notification", (notification) => {
      // Dispatch notification to NotificationSystem
      window.dispatchEvent(new CustomEvent('newNotification', {
        detail: notification
      }));
    });

    return () => {
      socket.off("newRequestCreated");
      socket.off("requestAccepted");
      socket.off("notification");
    };
  }, [user]);

  useEffect(() => {
    fetchNearby();
  }, [show24Hours]);

  // Countdown for selected request
  useEffect(() => {
    if (!selected) return;

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        new Date(selected.expiresAt) - new Date()
      );
      setTimer(Math.ceil(remaining / 1000));

      if (remaining <= 0) {
        setSelected(null);
        fetchNearby();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [selected]);

  const fetchNearby = () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const endpoint = show24Hours ? '/requests/all' : '/requests/nearby';
        const res = await API.get(
          `${endpoint}?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
        );
        setRequests(res.data);
      } catch (err) {
        console.error("Error fetching requests", err);
      }
    });
  };

  const fetchAcceptedRequests = async () => {
    try {
      const res = await API.get("/requests/my-accepted");
      setAcceptedRequests(res.data);
    } catch (err) {
      console.error("Error fetching accepted requests", err);
    }
  };

  const createRequest = async () => {
    const userRequests = requests.filter((r) => r.user._id === user._id);
    if (userRequests.length >= 3) {
      return alert("You can create max 3 requests");
    }
    setShowCreateModal(true);
  };

  const handleRequestCreated = (newRequest) => {
    fetchNearby();
  };

  const acceptRequest = async (req) => {
    try {
      const res = await API.post(`/requests/${req._id}/accept`);
      
      // Update user trust points
      await API.post('/auth/update-trust', { points: 100 });
      
      setSelected(res.data);
      
      // Emit request accepted notification
      socket.emit("acceptRequest", {
        requestId: req._id,
        helperId: user._id,
        helperName: user.name,
        requesterId: req.user._id
      });
      
      fetchNearby();
      fetchAcceptedRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Cannot accept request");
    }
  };

  const completeHelp = async () => {
    try {
      await API.post(`/requests/${selected._id}/complete`);
      
      socket.emit("completeRequest", {
        requestId: selected._id,
        helperId: user._id,
        requesterId: selected.user._id
      });
      
      alert("Help completed successfully!");
      setSelected(null);
      fetchNearby();
      fetchAcceptedRequests();
    } catch (err) {
      alert("Error completing help");
    }
  };

  const startNavigation = () => {
    if (!selected || !userLocation) return;
    
    setIsNavigating(true);
    
    // Start watching position
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        setUserLocation(newLocation);
        
        // Update live location in database
        API.post(`/requests/${selected._id}/location`, newLocation);
        
        // Emit location to other user
        socket.emit("shareLocation", {
          requestId: selected._id,
          userId: user._id,
          location: newLocation,
          timestamp: new Date()
        });
      },
      (error) => {
        console.error("Location error:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
    
    setWatchId(id);
    
    // Notify other user that navigation started
    socket.emit("startNavigation", {
      requestId: selected._id,
      userId: user._id,
      userName: user.name
    });
  };

  const stopNavigation = () => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsNavigating(false);
  };

  const getMapUrl = () => {
    if (!selected) return "";
    
    const requestLat = selected.location.coordinates[1];
    const requestLng = selected.location.coordinates[0];
    
    if (userLocation && selected.helper && selected.helper._id === user._id) {
      // Show both locations if user is the helper
      return `https://maps.google.com/maps?q=${requestLat},${requestLng}&z=15&output=embed`;
    } else if (userLocation && selected.user._id === user._id) {
      // Show helper location if user is the requester and request is accepted
      return `https://maps.google.com/maps?q=${requestLat},${requestLng}&z=15&output=embed`;
    }
    
    return `https://maps.google.com/maps?q=${requestLat},${requestLng}&z=15&output=embed`;
  };

  const handleRequestClick = (req) => {
    setSelected(req);
    // Only auto-accept if it's not user's own request and it's still active
    if (req.user._id !== user._id && req.status === 'active') {
      // Don't auto-accept, let user decide
    }
  };

  if (!user) return <p className="text-center mt-5">Loading user...</p>;

  return (
    <div className="container-fluid mt-3">
      <div className="row">
        {/* LEFT SIDEBAR */}
        <div className="col-md-3">
          {/* PROFILE CARD */}
          <div className="card shadow-sm mb-3">
            <div className="card-body p-3 text-center">
              <div
                className="rounded-circle bg-primary text-white mx-auto mb-2 d-flex align-items-center justify-content-center"
                style={{ width: 50, height: 50, fontSize: 20 }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <h6 className="fw-bold mb-1 small">{user.name}</h6>
              <span className="badge bg-success small">
                ⭐ {user.trustPoints} Trust
              </span>
            </div>
          </div>

          {/* MY CREATED REQUESTS */}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="fw-bold mb-0 d-flex align-items-center">
              <button 
                className="btn btn-sm btn-link p-0 me-2"
                onClick={() => setShowMyRequests(!showMyRequests)}
              >
                {showMyRequests ? '▼' : '▶'}
              </button>
              My Created Requests
            </h6>
            <div>
              <button className="btn btn-sm btn-outline-primary me-1" onClick={() => setShow24Hours(!show24Hours)}>
                {show24Hours ? '30min' : '24hrs'}
              </button>
              <button className="btn btn-sm btn-primary" onClick={createRequest}>
                + Create
              </button>
            </div>
          </div>

          {showMyRequests && requests.filter(req => req.user._id === user._id).map((req) => (
            <div
              key={req._id}
              className={`card shadow-sm mb-2 request-card ${selected?._id === req._id ? 'selected' : ''}`}
              onClick={() => handleRequestClick(req)}
              style={{ cursor: "pointer" }}
            >
              <div className="card-body p-2">
                <div className="d-flex align-items-center mb-1">
                  <span className="badge bg-info me-2">{req.category}</span>
                  <small className="text-muted">Created by you</small>
                </div>
                <p className="small mb-1">{req.description}</p>
                <div className="d-flex justify-content-between align-items-center">
                  <span className={`badge ${req.status === 'open' ? 'bg-success' : req.status === 'accepted' ? 'bg-warning' : 'bg-secondary'}`}>
                    {req.status}
                  </span>
                  {req.status === 'accepted' && req.helper && (
                    <small className="text-success">Helper: {req.helper.name}</small>
                  )}
                  {req.user._id === user._id && req.status === 'accepted' && (
                    <button 
                      className="btn btn-sm btn-success"
                      onClick={(e) => {
                        e.stopPropagation();
                        completeHelp();
                      }}
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* NEARBY REQUESTS */}
          <div className="d-flex justify-content-between align-items-center mb-2 mt-3">
            <h6 className="fw-bold mb-0 d-flex align-items-center">
              <button 
                className="btn btn-sm btn-link p-0 me-2"
                onClick={() => setShowNearbyRequests(!showNearbyRequests)}
              >
                {showNearbyRequests ? '▼' : '▶'}
              </button>
              Nearby Help Requests
            </h6>
            <button className="btn btn-sm btn-outline-secondary" onClick={fetchNearby}>
              🔄 Refresh
            </button>
          </div>

          {showNearbyRequests && requests.filter(req => req.user._id !== user._id).map((req) => (
            <div
              key={req._id}
              className={`card shadow-sm mb-2 request-card ${selected?._id === req._id ? 'selected' : ''}`}
              onClick={() => handleRequestClick(req)}
              style={{ cursor: "pointer" }}
            >
              <div className="card-body p-2">
                <div className="d-flex align-items-center mb-1">
                  <span className="badge bg-primary me-2">{req.category}</span>
                  <small className="text-muted">{req.user?.name}</small>
                </div>
                <p className="small mb-1">{req.description}</p>
                <div className="d-flex justify-content-between align-items-center">
                  <span className={`badge ${req.status === 'open' ? 'bg-success' : req.status === 'accepted' ? 'bg-warning' : 'bg-secondary'}`}>
                    {req.status}
                  </span>
                  {req.status === 'accepted' && req.helper && (
                    <small className="text-success">Helper: {req.helper.name}</small>
                  )}
                  {req.user._id !== user._id && req.status === 'open' && (
                    <button 
                      className="btn btn-sm btn-success"
                      onClick={(e) => {
                        e.stopPropagation();
                        acceptRequest(req);
                      }}
                    >
                      Accept
                    </button>
                  )}
                  {req.helper && req.helper._id === user._id && req.status === 'accepted' && (
                    <button 
                      className="btn btn-sm btn-warning"
                      onClick={(e) => {
                        e.stopPropagation();
                        completeHelp();
                      }}
                    >
                      Complete
                    </button>
                  )}
                  {(req.user._id === user._id || (req.helper && req.helper._id === user._id)) && req.status === 'accepted' && (
                    <button 
                      className="btn btn-sm btn-info ms-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(req);
                      }}
                    >
                      💬 Chat
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Remove complete button from bottom */}

          {selected && timer !== null && (
            <div className="text-end small mt-2 text-muted">
              Time left: {Math.floor(timer / 60)}m {timer % 60}s
            </div>
          )}
        </div>

        {/* RIGHT MAIN AREA */}
        <div className="col-md-9">
          {/* CREATE REQUEST */}
          <div className="card shadow-sm mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="fw-bold mb-0">Need Help?</h5>
                <button
                  className="btn btn-primary"
                  onClick={createRequest}
                  disabled={loading}
                >
                  🤝 Create Help Request
                </button>
              </div>
            </div>
          </div>

          {/* ACCEPTED REQUESTS SECTION - REMOVE THIS */}

          {/* MAP + CHAT - Show for any selected request */}
          {!selected ? (
            <div className="card shadow-sm h-100 d-flex align-items-center justify-content-center">
              <div className="text-center p-5">
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
                <p className="text-muted">Select a request to view details</p>
              </div>
            </div>
          ) : (
            <div className="row g-3">
              {/* LEFT: MAP */}
              <div className="col-md-6">
                <div className="card shadow-sm h-100">
                  <div className="card-header fw-bold d-flex justify-content-between align-items-center">
                    <span>Live Location</span>
                    <div>
                      {selected.status === 'accepted' && (
                        <span className="badge bg-success me-2">🟢 Connected</span>
                      )}
                      {selected.status === 'accepted' && (selected.user._id === user._id || selected.helper?._id === user._id) && !isNavigating && (
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={startNavigation}
                        >
                          🧭 Start Navigation
                        </button>
                      )}
                      {isNavigating && (
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={stopNavigation}
                        >
                          ⏹️ Stop Navigation
                        </button>
                      )}
                    </div>
                  </div>
                  <iframe
                    title="map"
                    width="100%"
                    height="100%"
                    style={{ border: 0, minHeight: "360px" }}
                    src={getMapUrl()}
                  />
                </div>
              </div>

              {/* RIGHT: CHAT - Allow chat for accepted and completed requests */}
              <div className="col-md-6">
                {(selected.status === 'accepted' || selected.status === 'completed' || selected.user._id === user._id) ? (
                  <ChatBox 
                    requestId={selected._id} 
                    requestData={selected}
                  />
                ) : (
                  <div className="card shadow-sm h-100 d-flex align-items-center justify-content-center">
                    <div className="text-center p-4">
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
                      <p className="text-muted small">Chat available when request is accepted</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* CREATE REQUEST MODAL */}
      {showCreateModal && (
        <CreateRequestModal 
          user={user}
          onRequestCreated={handleRequestCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
