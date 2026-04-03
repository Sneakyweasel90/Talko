import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import config from "../config";
import { APP_VERSION } from "../version";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.post(`${config.HTTP}/api/auth/login`, {
        username,
        password,
      });
      // Pass the plaintext password so the E2E key store can derive the PBKDF2 wrapping key
      // and load (or generate) the persisted ECDH private key from IndexedDB.
      await login(data, password);
      navigate("/");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || "Login failed");
      } else {
        setError("Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ ...styles.container, background: theme.background }}>
      {/* Drag region across the top */}
      <div
        style={{
          ...styles.dragbar,
          background: theme.surface2,
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <span style={{ ...styles.dragTitle, color: theme.primary }}>
          TALKO{" "}
          <span style={{ color: theme.textDim, fontSize: "0.6rem" }}>
            v{APP_VERSION}
          </span>
        </span>
        <div style={styles.winControls}>
          <button
            style={{ ...styles.winBtn, color: theme.textDim }}
            onClick={() => window.electronAPI?.minimize()}
          >
            ─
          </button>
          <button
            style={{ ...styles.winBtn, color: theme.textDim }}
            onClick={() => window.electronAPI?.maximize()}
          >
            □
          </button>
          <button
            style={{ ...styles.winBtn, color: theme.error }}
            onClick={() => window.electronAPI?.close()}
          >
            ✕
          </button>
        </div>
      </div>

      <div
        style={{
          ...styles.grid,
          backgroundImage: `linear-gradient(${theme.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${theme.gridColor} 1px, transparent 1px)`,
        }}
      />
      <div
        style={{
          ...styles.glow,
          background: `radial-gradient(ellipse, ${theme.primaryGlow} 0%, transparent 70%)`,
        }}
      />
      <div
        style={{
          ...styles.box,
          border: `1px solid ${theme.border}`,
          background: theme.surface,
          boxShadow: `0 0 40px ${theme.primaryGlow}`,
        }}
      >
        <div
          style={{
            ...styles.scanline,
            background: `linear-gradient(90deg, transparent, ${theme.primaryDim}, transparent)`,
          }}
        />
        <div style={styles.logoWrap}>
          <h1
            style={{
              ...styles.logo,
              color: theme.primary,
              textShadow: `0 0 20px ${theme.primaryDim}`,
            }}
          >
            TALKO
          </h1>
          <div style={{ ...styles.logoSub, color: theme.textDim }}>
            SECURE CHANNEL ACCESS
          </div>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldWrap}>
            <label style={{ ...styles.label, color: theme.textDim }}>
              IDENTIFIER
            </label>
            <input
              style={{
                ...styles.input,
                background: theme.primaryGlow,
                border: `1px solid ${theme.border}`,
                color: theme.primary,
              }}
              placeholder="enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div style={styles.fieldWrap}>
            <label style={{ ...styles.label, color: theme.textDim }}>
              PASSKEY
            </label>
            <input
              style={{
                ...styles.input,
                background: theme.primaryGlow,
                border: `1px solid ${theme.border}`,
                color: theme.primary,
              }}
              type="password"
              placeholder="enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p style={{ ...styles.error, color: theme.error }}>⚠ {error}</p>
          )}
          <button
            style={{
              ...styles.button,
              color: theme.primary,
              border: `1px solid ${theme.primaryDim}`,
            }}
            type="submit"
            disabled={loading}
          >
            {loading ? "CONNECTING..." : "LOG IN"}
          </button>
        </form>
        <p style={{ ...styles.link, color: theme.textDim }}>
          No account?{" "}
          <Link
            to="/register"
            style={{ color: theme.primary, textDecoration: "none" }}
          >
            CREATE IDENTITY
          </Link>
        </p>
      </div>
      <style>{`input::placeholder { color: ${theme.textDim}; opacity: 0.5; } input:focus { outline: none; }`}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
  },
  dragbar: {
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: "1rem",
    flexShrink: 0,
    zIndex: 10,
    WebkitAppRegion: "drag" as never,
    userSelect: "none",
  },
  dragTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.2em",
  },
  winControls: { display: "flex", WebkitAppRegion: "no-drag" as never },
  winBtn: {
    width: "46px",
    height: "32px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundSize: "40px 40px",
    top: "32px",
  },
  glow: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "600px",
    height: "400px",
    pointerEvents: "none",
  },
  box: {
    position: "relative",
    zIndex: 1,
    width: "360px",
    padding: "2.5rem",
    borderRadius: "2px",
    margin: "auto",
  },
  scanline: { position: "absolute", top: 0, left: 0, right: 0, height: "2px" },
  logoWrap: { textAlign: "center", marginBottom: "2rem" },
  logo: {
    fontFamily: "'Orbitron', monospace",
    fontSize: "2rem",
    fontWeight: 900,
    letterSpacing: "0.3em",
    margin: 0,
  },
  logoSub: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: "0.55rem",
    letterSpacing: "0.3em",
    marginTop: "0.3rem",
  },
  form: { display: "flex", flexDirection: "column", gap: "1.2rem" },
  fieldWrap: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  label: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: "0.6rem",
    letterSpacing: "0.15em",
  },
  input: {
    padding: "0.65rem 0.85rem",
    borderRadius: "2px",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: "0.85rem",
  },
  error: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: "0.7rem",
    margin: 0,
  },
  button: {
    background: "transparent",
    padding: "0.75rem",
    borderRadius: "2px",
    fontFamily: "'Orbitron', monospace",
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.15em",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  link: {
    textAlign: "center",
    marginTop: "1.5rem",
    marginBottom: 0,
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: "0.7rem",
  },
};
