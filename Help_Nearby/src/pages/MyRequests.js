import { useEffect, useState, useContext } from "react";
import API from "../api/api";
import { AuthContext } from "../context/AuthContext";
import "bootstrap/dist/css/bootstrap.min.css";

export default function MyRequests() {
  const { user } = useContext(AuthContext);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (user) {
      fetchMyRequests();
    }
  }, [user]);

  const fetchMyRequests = async () => {
    try {
      const res = await API.get("/requests/my-requests");
      setMyRequests(res.data);
    } catch (err) {
      console.error("Error fetching my requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      open: "bg-primary",
      accepted: "bg-warning",
      completed: "bg-success",
      expired: "bg-secondary"
    };
    return badges[status] || "bg-secondary";
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getFilteredRequests = () => {
    if (filter === 'all') return myRequests;
    return myRequests.filter(req => req.status === filter);
  };

  const getStatusCount = (status) => {
    if (status === 'all') return myRequests.length;
    return myRequests.filter(req => req.status === status).length;
  };

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h4 className="fw-bold">My Help Requests ({getFilteredRequests().length})</h4>
            <div className="d-flex gap-2 align-items-center">
              <select 
                className="form-select form-select-sm" 
                style={{width: 'auto'}}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All ({getStatusCount('all')})</option>
                <option value="open">Open ({getStatusCount('open')})</option>
                <option value="accepted">Accepted ({getStatusCount('accepted')})</option>
                <option value="completed">Completed ({getStatusCount('completed')})</option>
                <option value="expired">Expired ({getStatusCount('expired')})</option>
              </select>
              <span className="badge bg-info">{getFilteredRequests().length} Cards</span>
            </div>
          </div>

          {getFilteredRequests().length === 0 ? (
            <div className="card shadow-sm">
              <div className="card-body text-center py-5">
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                <h5>No {filter === 'all' ? '' : filter} requests</h5>
                <p className="text-muted">Your {filter === 'all' ? 'help' : filter} requests will appear here</p>
              </div>
            </div>
          ) : (
            <div className="row g-3">
              {getFilteredRequests().map((request) => (
                <div key={request._id} className="col-md-6 col-lg-4">
                  <div className="card shadow-sm h-100">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <span className="badge bg-primary">{request.category}</span>
                        <span className={`badge ${getStatusBadge(request.status)}`}>
                          {request.status.toUpperCase()}
                        </span>
                      </div>
                      
                      <p className="card-text mb-3">{request.description}</p>
                      
                      <div className="small text-muted mb-2">
                        <div><strong>Created:</strong> {formatDate(request.createdAt)}</div>
                        {request.acceptedAt && (
                          <div><strong>Accepted:</strong> {formatDate(request.acceptedAt)}</div>
                        )}
                        {request.completedAt && (
                          <div><strong>Completed:</strong> {formatDate(request.completedAt)}</div>
                        )}
                      </div>

                      {request.helper && (
                        <div className="mt-3 p-2 bg-light rounded">
                          <small className="text-muted">Helper:</small>
                          <div className="d-flex align-items-center">
                            <div className="rounded-circle bg-success text-white me-2 d-flex align-items-center justify-content-center" 
                                 style={{ width: 30, height: 30, fontSize: 12 }}>
                              {request.helper.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="fw-bold small">{request.helper.name}</div>
                              <div className="text-muted" style={{ fontSize: '11px' }}>
                                ⭐ {request.helper.trustPoints} Trust Points
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {request.completedBy && request.completedBy._id !== user._id && (
                        <div className="mt-2 p-2 bg-success bg-opacity-10 rounded">
                          <small className="text-success">
                            ✅ Completed by {request.completedBy.name}
                          </small>
                        </div>
                      )}
                      
                      {request.status === 'accepted' && (request.user._id === user._id || (request.helper && request.helper._id === user._id)) && (
                        <button 
                          className="btn btn-sm btn-info mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Navigate to dashboard with this request selected
                            window.location.href = `/dashboard?requestId=${request._id}`;
                          }}
                        >
                          💬 Chat
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}