import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { envoyerMessage, type EnvoyerMessageData } from "../services/messageService";
import NouveauMessage from "../components/NouveauMessage";
import type { MessagerieContext, OptionsNouveauMessage } from "./MessagerieContext";
import "./BoiteReception.css";

// Layout : la sidebar reste fixe, seule la zone <Outlet /> change selon la page.
export default function MessagerieLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [nouveauMessage, setNouveauMessage] = useState<OptionsNouveauMessage | null>(null);
  const [version, setVersion] = useState(0);

  function deconnexion() {
    sessionStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  function classeNav(chemin: string) {
    return pathname.startsWith(`/messagerie/${chemin}`) ? "mail-nav-active" : "";
  }

  // ---------------------------------------------------------
  // Envoi d'un message (nouveau message ou réponse)
  // ---------------------------------------------------------
  async function gererEnvoi(data: EnvoyerMessageData) {
    try {
      const resultat = await envoyerMessage(data);

      setNouveauMessage(null);
      setVersion((v) => v + 1); // recharge la page affichée

      // On retourne le résultat pour que NouveauMessage puisse envoyer les fichiers
      return resultat;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Erreur lors de l'envoi du message.";
      throw new Error(msg);
    }
  }

  const contexte: MessagerieContext = {
    ouvrirNouveauMessage: (options = {}) => setNouveauMessage(options),
    version,
  };

  return (
    <div className="mail-layout">
      <aside className="mail-sidebar">
        <h2>Messagerie</h2>

        <button className="mail-compose" onClick={() => setNouveauMessage({})}>
          + Nouveau message
        </button>

        <nav>
          <button
            className={classeNav("reception")}
            onClick={() => navigate("/messagerie/reception")}
          >
            Boîte de réception
          </button>
          <button disabled>Messages envoyés</button>
          <button
            className={classeNav("archives")}
            onClick={() => navigate("/messagerie/archives")}
          >
            Archives
          </button>
          <button
            className={classeNav("corbeille")}
            onClick={() => navigate("/messagerie/corbeille")}
          >
            Corbeille
          </button>
        </nav>

        <button className="mail-logout" onClick={deconnexion}>
          Déconnexion
        </button>
      </aside>

      <main className="mail-main">
        <Outlet context={contexte} />
      </main>

      {nouveauMessage && (
        <NouveauMessage
          onClose={() => setNouveauMessage(null)}
          onEnvoyer={gererEnvoi}
          initialObjet={nouveauMessage.objet}
          initialIdMessParent={nouveauMessage.idMessParent}
        />
      )}
    </div>
  );
}