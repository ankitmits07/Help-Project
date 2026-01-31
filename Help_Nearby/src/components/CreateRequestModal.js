import { useState } from "react";
import API from "../api/api";
import socket from "../socket";

export default function CreateRequestModal({ user, onRequestCreated, onClose }) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [minutes, setMinutes] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const categories = [
    { value: "Groceries", icon: "🛒", desc: "Shopping assistance" },
    { value: "Medical", icon: "🏥", desc: "Medical emergency or help" },
    { value: "Tech Help", icon: "💻", desc: "Technical support" },
    { value: "Emergency", icon: "🚨", desc: "Urgent assistance needed" },
    { value: "Transport", icon: "🚗", desc: "Transportation help" },
    { value: "Food", icon: "🍕", desc: "Food delivery or cooking" },
    { value: "Pet Care", icon: "🐕", desc: "Pet sitting or walking" },
    { value: "Other", icon: "🤝", desc: "General assistance" }
  ];

  const timeOptions = [
    { value: 15, label: "15 minutes" },
    { value: 30, label: "30 minutes" },
    { value: 60, label: "1 hour" },
    { value: 120, label: "2 hours" },
    { value: 240, label: "4 hours" }
  ];

  const visibilityOptions = [
    { value: "public", label: "Public", desc: "Visible to everyone nearby" },
    { value: "nearby", label: "Nearby Only", desc: "Only users within 1km" },
    { value: "friends", label: "Friends", desc: "Only your trusted contacts" }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!category || !description.trim()) {
      setError("Please fill all required fields");
      return;
    }

    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const newRequest = await API.post("/requests", {
            category,
            description: description.trim(),
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            minutes,
            visibility
          });

          // Emit new request to other users
          socket.emit("createRequest", {
            requestId: newRequest.data._id,
            userId: user._id,
            userName: user.name,
            category,
            description: description.trim(),
            location: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            },
            visibility,
            expiresAt: newRequest.data.expiresAt
          });

          onRequestCreated(newRequest.data);
          onClose();
        } catch (err) {
          setError(err.response?.data?.message || "Failed to create request");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError("Location permission denied");
        setLoading(false);
      }
    );
  };

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">🤝 Create Help Request</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger py-2 mb-3">
                  {error}
                </div>
              )}

              {/* Category Selection */}
              <div className="mb-4">
                <label className="form-label fw-semibold">Category *</label>
                <div className="row g-2">
                  {categories.map((cat) => (
                    <div key={cat.value} className="col-6 col-md-4">
                      <div 
                        className={`card category-card ${category === cat.value ? 'selected' : ''}`}
                        onClick={() => setCategory(cat.value)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="card-body text-center p-2">
                          <div style={{ fontSize: '24px' }}>{cat.icon}</div>
                          <div className="fw-bold small">{cat.value}</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>{cat.desc}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="mb-3">
                <label className="form-label fw-semibold">Description *</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Describe what help you need in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                />
                <div className="text-end small text-muted">
                  {description.length}/500 characters
                </div>
              </div>

              {/* Visibility */}
              <div className="mb-3">
                <label className="form-label fw-semibold">Visibility</label>
                <div className="row g-2">
                  {visibilityOptions.map((option) => (
                    <div key={option.value} className="col-12 col-md-4">
                      <div 
                        className={`card visibility-card ${visibility === option.value ? 'selected' : ''}`}
                        onClick={() => setVisibility(option.value)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="card-body p-2">
                          <div className="fw-bold small">{option.label}</div>
                          <div className="text-muted" style={{ fontSize: '11px' }}>{option.desc}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time Duration */}
              <div className="mb-3">
                <label className="form-label fw-semibold">Request Duration</label>
                <select 
                  className="form-select"
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                >
                  {timeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="text-muted small mt-1">
                  Your request will automatically expire after this time
                </div>
              </div>

              {/* Location Info */}
              <div className="alert alert-info py-2">
                <small>
                  📍 Your current location will be shared with nearby helpers
                </small>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={loading || !category || !description.trim()}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Creating...
                  </>
                ) : (
                  "Create Request"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}