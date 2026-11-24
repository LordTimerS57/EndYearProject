import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import Login from "./pages/Login";
import Inscription from "./pages/Inscription";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUtilisateurs from "./pages/AdminUtilisateurs";
import AdminInscriptions from "./pages/AdminInscriptions";
import MessagerieLayout from "./pages/MessagerieLayout";
import ListeMessages from "./pages/ListeMessages";
import LectureConversation from "./pages/LectureConversation";
import Brouillons from "./pages/Brouillons";
import Programmes from "./pages/Programmes";
import {
  obtenirExpirationJeton,
  redirigerVersConnexion,
  supprimerSession,
} from "./services/sessionService";

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
            supprimerSession();
            window.location.replace("/login");
          }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

function RouteProtegee({ children }: { children: ReactNode }) {
  const token = sessionStorage.getItem("token");
  const expiration = token ? obtenirExpirationJeton(token) : null;
  const sessionValide =
    token !== null && expiration !== null && expiration > Date.now();

  useEffect(() => {
    if (!token) return;

    if (expiration === null || expiration <= Date.now()) {
      supprimerSession();
      return;
    }

    const verifierExpiration = () => {
      if (Date.now() >= expiration) redirigerVersConnexion();
    };
    const timer = window.setTimeout(
      verifierExpiration,
      expiration - Date.now()
    );

    window.addEventListener("focus", verifierExpiration);
    document.addEventListener("visibilitychange", verifierExpiration);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", verifierExpiration);
      document.removeEventListener("visibilitychange", verifierExpiration);
    };
  }, [token, expiration]);

  return sessionValide ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/admin"
          element={
            <RouteProtegee>
              <AdminLayout />
            </RouteProtegee>
          }
        >
  <Route
    index
    element={<Navigate to="/admin/dashboard" replace />}
  />

  <Route
    path="dashboard"
    element={<AdminDashboard />}
  />

  <Route
    path="utilisateurs"
    element={<AdminUtilisateurs />}
  />

  <Route
    path="inscriptions"
    element={<AdminInscriptions />}
  />
</Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/inscription" element={<Inscription />} />

        <Route
          path="/accueil"
          element={
            <RouteProtegee>
              <Accueil />
            </RouteProtegee>
          }
        />

        {/* Messagerie : sidebar fixe (layout) + pages dynamiques (Outlet) */}
        <Route
          path="/messagerie"
          element={
            <RouteProtegee>
              <MessagerieLayout />
            </RouteProtegee>
          }
        >
          <Route path="envoyes" element={<ListeMessages dossier="envoyes" />} />
          <Route index element={<Navigate to="reception" replace />} />
          <Route path="reception" element={<ListeMessages dossier="boite" />} />
          <Route path="archives" element={<ListeMessages dossier="archive" />} />
          <Route path="corbeille" element={<ListeMessages dossier="corbeille" />} />
          <Route path="brouillons" element={<Brouillons />} />
          <Route path="programmes" element={<Programmes />} />
          <Route path="conversation/:idConv" element={<LectureConversation />} />
        </Route>

        {/* Ancienne adresse : redirigée vers la nouvelle messagerie */}
        <Route
          path="/boite-reception"
          element={<Navigate to="/messagerie/reception" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}