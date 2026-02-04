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
  const [showAllMyRequests, setShowAllMyRequests] = useState(false);
  const [showAllNearbyRequests, setShowAllNearbyRequests] = useState(false);

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
    
    // Listen for new requests (auto-refresh nearby only)
    socket.on("newRequestCreated", (data) => {
      console.log('New request received:', data);
      
      // Only add new requests, don't remove existing ones
      if (data.userId !== user._id) {
        setRequests(prev => {
          const exists = prev.find(r => r._id === data.requestId);
          if (!exists) {
            return [...prev, {
              _id: data.requestId,
              user: { _id: data.userId, name: data.userName },
              category: data.category,
              description: data.description,
              location: data.location,
              status: 'open',
              createdAt: new Date()
            }];
          }
          return prev;
        });
        
        // Store notification in localStorage for persistence
        const notification = {
          id: Date.now(),
          type: 'request',
          title: 'New Help Request Nearby',
          message: `${data.userName} needs help with ${data.category}`,
          icon: '🆘',
          persistent: true,
          timestamp: new Date().toISOString(),
          requestData: data
        };
        
        // Store in localStorage
        const existingNotifications = JSON.parse(localStorage.getItem('helpNotifications') || '[]');
        existingNotifications.push(notification);
        localStorage.setItem('helpNotifications', JSON.stringify(existingNotifications));
        
        // Show notification
        window.dispatchEvent(new CustomEvent('newNotification', {
          detail: notification
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

  const fetchNearby = async () => {
    try {
      // First get user's own requests
      const myRequestsRes = await API.get('/requests/my-requests');
      
      // Then get nearby requests
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const endpoint = show24Hours ? '/requests/all' : '/requests/nearby';
          const nearbyRes = await API.get(
            `${endpoint}?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
          );
          
          // Combine user's requests with nearby requests (limit nearby to 3)
          const nearbyRequests = nearbyRes.data
            .filter(req => req.status !== 'completed')
            .slice(0, 3);
          
          setRequests([...myRequestsRes.data, ...nearbyRequests]);
        } catch (err) {
          console.error("Error fetching nearby requests", err);
          // If geolocation fails, at least show user's own requests
          setRequests(myRequestsRes.data);
        }
      }, (error) => {
        console.error("Geolocation error:", error);
        // If geolocation fails, at least show user's own requests
        setRequests(myRequestsRes.data);
      });
    } catch (err) {
      console.error("Error fetching my requests", err);
    }
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

  const completeHelp = async (requestId = null) => {
    try {
      const reqId = requestId || selected._id;
      await API.post(`/requests/${reqId}/complete`);
      
      socket.emit("completeRequest", {
        requestId: reqId,
        helperId: user._id,
        requesterId: selected?.user?._id || requests.find(r => r._id === reqId)?.user?._id
      });
      
      alert("Help completed successfully!");
      if (!requestId) setSelected(null);
      fetchNearby();
      fetchAcceptedRequests();
    } catch (err) {
      alert("Error completing help: " + (err.response?.data?.message || err.message));
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
    
    if (userLocation && selected.status === 'accepted' && isNavigating) {
      // Show live directions between both users when navigation is active
      const userLat = userLocation.lat;
      const userLng = userLocation.lng;
      return `https://www.google.com/maps/dir/${userLat},${userLng}/${requestLat},${requestLng}/@${(userLat + requestLat) / 2},${(userLng + requestLng) / 2},13z`;
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

  const getTimeAgo = (date) => {
    const now = new Date();
    const requestTime = new Date(date);
    const diffInMinutes = Math.floor((now - requestTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  const getDistanceText = (req) => {
    if (!userLocation || !req.location?.coordinates) return '';
    
    const reqLat = req.location.coordinates[1];
    const reqLng = req.location.coordinates[0];
    
    return calculateDistance(userLocation.lat, userLocation.lng, reqLat, reqLng);
  };

  const isRequestExpired = (req) => {
    if (!req.expiresAt) return false;
    return new Date() > new Date(req.expiresAt);
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
            <h6 className="fw-bold mb-0">My Created Requests</h6>
          </div>

          {requests
            .filter(req => req.user._id === user._id && req.status !== 'completed' && !isRequestExpired(req))
            .slice(0, showAllMyRequests ? undefined : 3)
            .map((req) => (
            <div
              key={req._id}
              className={`card shadow-sm mb-2 request-card ${selected?._id === req._id ? 'selected' : ''}`}
              onClick={() => handleRequestClick(req)}
              style={{ cursor: "pointer" }}
            >
              <div className="card-body p-2">
                <div className="d-flex align-items-center mb-1">
                  <span className="badge bg-info me-2">{req.category}</span>
                  <small className="text-muted">{getTimeAgo(req.createdAt || req.acceptedAt)}</small>
                </div>
                <p className="small mb-1">{req.description}</p>
                <div className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <span className={`badge ${req.status === 'open' ? 'bg-success' : req.status === 'accepted' ? 'bg-warning' : 'bg-secondary'}`}>
                      {req.status}
                    </span>
                    {userLocation && req.location?.coordinates && (
                      <small className="text-muted">{getDistanceText(req)}</small>
                    )}
                  </div>
                  {req.status === 'accepted' && req.helper && (
                    <button 
                      className="btn btn-sm btn-success"
                      onClick={(e) => {
                        e.stopPropagation();
                        completeHelp(req._id);
                      }}
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {requests.filter(req => req.user._id === user._id && req.status !== 'completed' && !isRequestExpired(req)).length > 3 && (
            <button 
              className="btn btn-sm btn-outline-primary w-100 mb-3"
              onClick={() => setShowAllMyRequests(!showAllMyRequests)}
            >
              {showAllMyRequests ? 'Show Less' : `Show More (${requests.filter(req => req.user._id === user._id && req.status !== 'completed' && !isRequestExpired(req)).length - 3})`}
            </button>
          )}

          {/* NEARBY REQUESTS */}
          <div className="d-flex justify-content-between align-items-center mb-2 mt-3">
            <h6 className="fw-bold mb-0">Nearby Help Requests</h6>
          </div>

          {/* Show accepted requests first with helping card style */}
          {acceptedRequests
            .filter(req => req.status !== 'completed' && !isRequestExpired(req))
            .slice(0, showAllNearbyRequests ? undefined : 3)
            .map((req) => (
            <div
              key={req._id}
              className={`card shadow-sm mb-2 request-card ${selected?._id === req._id ? 'selected' : ''}`}
              onClick={() => handleRequestClick(req)}
              style={{ cursor: "pointer" }}
            >
              <div className="card-body p-2">
                <div className="d-flex align-items-center mb-1">
                  <span className="badge bg-warning me-2">{req.category}</span>
                  <small className="text-muted">{getTimeAgo(req.acceptedAt || req.createdAt)}</small>
                </div>
                <p className="small mb-1">{req.description}</p>
                <div className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-warning">HELPING</span>
                    {userLocation && req.location?.coordinates && (
                      <small className="text-muted">{getDistanceText(req)}</small>
                    )}
                  </div>
                  <button 
                    className="btn btn-sm btn-success"
                    onClick={(e) => {
                      e.stopPropagation();
                      completeHelp(req._id);
                    }}
                  >
                    Complete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Show other nearby requests */}
          {requests
            .filter(req => req.user._id !== user._id && req.status !== 'completed' && !isRequestExpired(req))
            .slice(acceptedRequests.length, showAllNearbyRequests ? undefined : 3)
            .map((req) => (
            <div
              key={req._id}
              className={`card shadow-sm mb-2 request-card ${selected?._id === req._id ? 'selected' : ''}`}
              onClick={() => handleRequestClick(req)}
              style={{ cursor: "pointer" }}
            >
              <div className="card-body p-2">
                <div className="d-flex align-items-center mb-1">
                  <span className="badge bg-primary me-2">{req.category}</span>
                  <small className="text-muted">{getTimeAgo(req.createdAt)}</small>
                </div>
                <p className="small mb-1">{req.description}</p>
                <div className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <span className={`badge ${req.status === 'open' ? 'bg-success' : req.status === 'accepted' ? 'bg-warning' : 'bg-secondary'}`}>
                      {req.status}
                    </span>
                    {userLocation && req.location?.coordinates && (
                      <small className="text-muted">{getDistanceText(req)}</small>
                    )}
                  </div>
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
                      className="btn btn-sm btn-success"
                      onClick={(e) => {
                        e.stopPropagation();
                        completeHelp(req._id);
                      }}
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {(acceptedRequests.filter(req => req.status !== 'completed' && !isRequestExpired(req)).length + 
            requests.filter(req => req.user._id !== user._id && req.status !== 'completed' && !isRequestExpired(req)).length) > 3 && (
            <button 
              className="btn btn-sm btn-outline-primary w-100 mb-3"
              onClick={() => setShowAllNearbyRequests(!showAllNearbyRequests)}
            >
              {showAllNearbyRequests ? 'Show Less' : 
                `Show More (${(acceptedRequests.filter(req => req.status !== 'completed' && !isRequestExpired(req)).length + 
                requests.filter(req => req.user._id !== user._id && req.status !== 'completed' && !isRequestExpired(req)).length) - 3})`}
            </button>
          )}

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
                          🧭 Start Direction
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
                <div className="card shadow-sm h-100">
                  <div className="card-header fw-bold d-flex justify-content-between align-items-center">
                    <span>Request Details</span>
                    {(selected.status === 'accepted' || selected.status === 'completed') && 
                     (selected.user._id === user._id || selected.helper?._id === user._id) && (
                      <button 
                        className="btn btn-sm btn-success"
                        onClick={() => completeHelp(selected._id)}
                      >
                        Complete Request
                      </button>
                    )}
                  </div>
                  {(selected.status === 'accepted' || selected.status === 'completed' || selected.user._id === user._id) ? (
                    <ChatBox 
                      requestId={selected._id} 
                      requestData={selected}
                    />
                  ) : (
                    <div className="card-body d-flex align-items-center justify-content-center h-100">
                      <div className="text-center p-4">
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
                        <p className="text-muted small">Chat available when request is accepted</p>
                      </div>
                    </div>
                  )}
                </div>
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
