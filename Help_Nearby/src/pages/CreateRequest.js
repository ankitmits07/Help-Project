import API from "../api/api";
import { useState } from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';


export default function CreateRequest() {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = () => {
    setError("");

    if (!description.trim() || !category) {
      setError("Please fill all fields");
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
          await API.post("/requests", {
            description: description.trim(),
            category,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            minutes: 30
          });

          setDescription("");
          setCategory("");
          alert("Help request created successfully");
        } catch (err) {
          setError("Failed to create request");
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
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-lg-5 col-md-7 col-sm-10">
          <div className="card shadow-lg border-0 rounded-4">
            <div className="card-body p-4">

              <h4 className="fw-bold text-center mb-2">
                Create Help Request
              </h4>

              <p className="text-muted text-center small mb-4">
                Nearby users will be notified instantly
              </p>

              {error && (
                <div className="alert alert-danger py-2">
                  {error}
                </div>
              )}

              <div className="mb-3">
                <label className="form-label fw-semibold">
                  Category
                </label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Select category</option>
                  <option value="Groceries">Groceries</option>
                  <option value="Medical">Medical</option>
                  <option value="Tech Help">Tech Help</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">
                  Description
                </label>
                <textarea
                  className="form-control"
                  rows="4"
                  placeholder="Explain what kind of help you need..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <button
                className="btn btn-primary w-100 rounded-pill py-2"
                onClick={submit}
                disabled={loading}
              >
                {loading ? "Creating request..." : "Create Request"}
              </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
