import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  CalendarClock,
  FileText,
  GraduationCap,
  Inbox,
  LogOut,
  PenLine,
  Send,
  Trash2,
} from "lucide-react";
import {
  creerBrouillon,
  envoyerBrouillon,
  envoyerMessage,
  modifierBrouillon,
  supprimerBrouillon,
  supprimerFichierBrouillon,
  type BrouillonData,
  type BrouillonDetail,
  type EnvoyerMessageData,
} from "../services/messageService";
import NouveauMessage from "../components/NouveauMessage";
import type { MessagerieContext, OptionsNouveauMessage } from "./MessagerieContext";
import "./BoiteReception.css";

// Layout : la sidebar reste fixe, seule la zone <Outlet /> change selon la page.
export default function MessagerieLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [nouveauMessage, setNouveauMessage] = useState<OptionsNouveauMessage | null>(null);
  const [brouillonInitial, setBrouillonInitial] = useState<BrouillonDetail | null>(null);
  const [version, setVersion] = useState(0);

  function fermerComposeur() {
    setNouveauMessage(null);
    setBrouillonInitial(null);
  }

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

      fermerComposeur();
      setVersion((v) => v + 1); // recharge la page affichée

      // On retourne le résultat pour que NouveauMessage puisse envoyer les fichiers
      return resultat;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Erreur lors de l'envoi du message.";
      throw new Error(msg);
    }
  }

  async function gererSauvegardeBrouillon(
    data: BrouillonData,
    idMess?: number
  ) {
    return idMess === undefined
      ? creerBrouillon(data)
      : modifierBrouillon(idMess, data);
  }

  async function gererEnvoiBrouillon(idMess: number) {
    const resultat = await envoyerBrouillon(idMess);
    fermerComposeur();
    setVersion((v) => v + 1);
    return resultat;
  }

  async function gererSuppressionBrouillon(idMess: number) {
    await supprimerBrouillon(idMess);
    fermerComposeur();
    setVersion((v) => v + 1);
  }

  async function gererSuppressionFichierBrouillon(idMess: number, idPiece: number) {
    await supprimerFichierBrouillon(idMess, idPiece);
    setVersion((v) => v + 1);
  }

  const contexte: MessagerieContext = {
    ouvrirNouveauMessage: (options = {}) => {
      setBrouillonInitial(null);
      setNouveauMessage(options);
    },
    ouvrirBrouillon: (brouillon) => {
      setBrouillonInitial(brouillon);
      setNouveauMessage({});
    },
    version,
  };

  return (
    <div className="mail-layout">
      <aside className="mail-sidebar">
        <div className="mail-brand">
          <div className="mail-brand-icon">
            <GraduationCap size={34} aria-hidden="true" />
          </div>
          <div>
            <h2>ENI</h2>
            <span>Fianarantsoa</span>
          </div>
        </div>

        <div className="mail-sidebar-divider" />
        <div className="mail-menu-label">MESSAGERIE</div>

        <button className="mail-compose" onClick={() => contexte.ouvrirNouveauMessage()}>
          <PenLine size={18} aria-hidden="true" />
          <span>Nouveau message</span>
        </button>

        <nav>
          <button
            className={classeNav("reception")}
            onClick={() => navigate("/messagerie/reception")}
          >
            <Inbox size={18} aria-hidden="true" />
            Boîte de réception
          </button>
          <button
            className={classeNav("envoyes")}
            onClick={() => navigate("/messagerie/envoyes")}
          >
            <Send size={18} aria-hidden="true" />
            Messages envoyés
          </button>
          <button
            className={classeNav("archives")}
            onClick={() => navigate("/messagerie/archives")}
          >
            <Archive size={18} aria-hidden="true" />
            Archives
          </button>
          <button
            className={classeNav("corbeille")}
            onClick={() => navigate("/messagerie/corbeille")}
          >
            <Trash2 size={18} aria-hidden="true" />
            Corbeille
          </button>
          <button
            className={classeNav("brouillons")}
            onClick={() => navigate("/messagerie/brouillons")}
          >
            <FileText size={18} aria-hidden="true" />
            Brouillons
          </button>
          <button
            className={classeNav("programmes")}
            onClick={() => navigate("/messagerie/programmes")}
          >
            <CalendarClock size={18} aria-hidden="true" />
            Messages programmés
          </button>
        </nav>

        <div className="mail-sidebar-bottom">
          <button className="mail-logout" onClick={deconnexion}>
            <LogOut size={18} aria-hidden="true" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <main className="mail-main">
        <Outlet context={contexte} />
      </main>

      {nouveauMessage && (
        <NouveauMessage
          onClose={fermerComposeur}
          onEnvoyer={gererEnvoi}
          initialBrouillon={brouillonInitial ?? undefined}
          onSauvegarderBrouillon={gererSauvegardeBrouillon}
          onEnvoyerBrouillon={gererEnvoiBrouillon}
          onSupprimerBrouillon={gererSuppressionBrouillon}
          onSupprimerFichierBrouillon={gererSuppressionFichierBrouillon}
          onBrouillonModifie={() => setVersion((v) => v + 1)}
          initialObjet={nouveauMessage.objet}
          initialIdMessParent={nouveauMessage.idMessParent}
          initialDestinataire={nouveauMessage.initialDestinataire}
        />
      )}
    </div>
  );
}