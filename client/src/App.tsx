import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LocalNicknameProvider } from "./context/LocalNicknameContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./components/chat/Chat";
import SuperAdmin from "./pages/SuperAdmin";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== "admin") return <Navigate to="/" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LocalNicknameProvider>
          <HashRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Chat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin"
                element={
                  <AdminRoute>
                    <SuperAdmin />
                  </AdminRoute>
                }
              />
            </Routes>
          </HashRouter>
        </LocalNicknameProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
