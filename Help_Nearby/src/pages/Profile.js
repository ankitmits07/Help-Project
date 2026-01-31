import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import "bootstrap/dist/css/bootstrap.min.css";

export default function Profile() {
  const { user } = useContext(AuthContext);

  const getTrustLevel = (points) => {
    if (points >= 80) return { label: "High", color: "success" };
    if (points >= 40) return { label: "Medium", color: "warning" };
    return { label: "Low", color: "danger" };
  };

  const trust = getTrustLevel(user.trustPoints || 0);

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-5 col-sm-10">
          <div className="card shadow-lg border-0 rounded-4 text-center">

            {/* Avatar */}
            <div className="mt-4">
              <div
                className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center"
                style={{
                  width: 80,
                  height: 80,
                  fontSize: 32,
                  fontWeight: "bold"
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>

            <div className="card-body p-4">
              <h4 className="fw-bold mb-1">{user.name}</h4>
              <p className="text-muted mb-3">{user.email}</p>

              {/* Trust badge */}
              <span className={`badge bg-${trust.color} px-3 py-2 mb-3`}>
                Trust Level: {trust.label}
              </span>

              {/* Trust points */}
              <div className="mt-3">
                <h6 className="text-muted mb-1">Trust Points</h6>
                <h3 className="fw-bold">{user.trustPoints || 0}</h3>
              </div>

              <hr />

              {/* Info */}
              <p className="text-muted small">
                Helping nearby people increases your trust score.
                Canceling requests may reduce it.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
