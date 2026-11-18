
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Inscription from "./pages/Inscription";
import AdminUtilisateurs from "./pages/AdminUtilisateurs";
function Accueil() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">M</div>
        <h1>Bienvenue</h1>
        <p className="auth-subtitle">
          Votre connexion à la messagerie a réussi.
        </p>
        <button
          className="auth-button"
          onClick={() => {
            sessionStorage.removeItem("token");
            window.location.href = "/login";
          }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/inscription" element={<Inscription />} />
        <Route
          path="/accueil"
          element={
            sessionStorage.getItem("token")
              ? <Accueil />
              : <Navigate to="/login" replace />
          }
        />
        <Route
  path="/admin/utilisateurs"
  element={
    sessionStorage.getItem("token")
      ? <AdminUtilisateurs />
      : <Navigate to="/login" replace />
  }
/>
      </Routes>
    </BrowserRouter>
  );
}
