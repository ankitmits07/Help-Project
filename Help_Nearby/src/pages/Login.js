import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import API from "../api/api";

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);
      const res = await API.post("/auth/login", { email, password });
      login(res.data);
      navigate("/dashboard");
    } catch (err) {
      alert(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #6e8efb, #a777e3)"
      }}
    >
      <div
        className="card shadow-lg"
        style={{
          width: "400px",
          borderRadius: "1rem",
          padding: "2rem",
          backgroundColor: "rgba(255,255,255,0.95)"
        }}
      >
        <div className="text-center mb-4">
          <h2 className="fw-bold" style={{ color: "#4a4a4a" }}>Help Nearby</h2>
          <p className="text-muted" style={{ fontSize: "0.9rem" }}>Sign in to continue</p>
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold">Email</label>
          <input
            type="email"
            className="form-control shadow-sm"
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ borderRadius: "0.75rem" }}
          />
        </div>

        <div className="mb-4">
          <label className="form-label fw-semibold">Password</label>
          <input
            type="password"
            className="form-control shadow-sm"
            placeholder="Enter your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ borderRadius: "0.75rem" }}
          />
        </div>

        <button
          className="btn w-100 text-white fw-bold"
          onClick={submit}
          disabled={loading}
          style={{
            borderRadius: "2rem",
            padding: "0.6rem",
            background: "linear-gradient(to right, #6e8efb, #a777e3)",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            fontSize: "1rem"
          }}
        >
          {loading ? "Signing in..." : "Login"}
        </button>

        <div className="text-center mt-3">
          <span className="text-muted" style={{ fontSize: "0.85rem" }}>
            Don't have an account?{" "}
            <a
              href="/register"
              style={{ textDecoration: "none", color: "#6e8efb", fontWeight: "500" }}
            >
              Register
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
