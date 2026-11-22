import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import Login from "./pages/Login";
import Inscription from "./pages/Inscription";
import AdminUtilisateurs from "./pages/AdminUtilisateurs";
import MessagerieLayout from "./pages/MessagerieLayout";
import ListeMessages from "./pages/ListeMessages";
import LectureConversation from "./pages/LectureConversation";
import Brouillons from "./pages/Brouillons";

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

// Vérifie le token à chaque affichage de la route (et pas une seule fois au
// chargement de App), pour que la protection reste correcte après une connexion
// ou une déconnexion sans rechargement de la page.
function RouteProtegee({ children }: { children: ReactNode }) {
  return sessionStorage.getItem("token") ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" replace />
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
          <Route path="conversation/:idConv" element={<LectureConversation />} />
        </Route>

        {/* Ancienne adresse : redirigée vers la nouvelle messagerie */}
        <Route
          path="/boite-reception"
          element={<Navigate to="/messagerie/reception" replace />}
        />

        <Route
          path="/admin/utilisateurs"
          element={
            <RouteProtegee>
              <AdminUtilisateurs />
            </RouteProtegee>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}