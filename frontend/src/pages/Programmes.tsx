import axios from "axios";
import { useEffect, useState } from "react";
import { CalendarClock, Pencil, RefreshCw, XCircle } from "lucide-react";
import {
  annulerProgrammation,
  getBrouillon,
  getMessagesProgrammes,
  type MessageProgramme,
} from "../services/messageService";
import { useMessagerie } from "./MessagerieContext";
import "./Programmes.css";

function messageErreur(erreur: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(erreur)) {
    return erreur.response?.data?.message ?? erreur.message;
  }
  return erreur instanceof Error ? erreur.message : "Une erreur est survenue.";
}

function afficherDate(date: string): string {
  const valeur = new Date(date);
  return Number.isNaN(valeur.getTime())
    ? "Date invalide"
    : valeur.toLocaleString("fr-FR");
}

export default function Programmes() {
  const { ouvrirBrouillon, version, searchTerm, searchMode, dateFilter } = useMessagerie();
  const [messages, setMessages] = useState<MessageProgramme[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [recharge, setRecharge] = useState(0);
  const [annulationEnCours, setAnnulationEnCours] = useState<number | null>(null);
  const [brouillonEnOuverture, setBrouillonEnOuverture] = useState<number | null>(null);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur("");

    async function charger() {
      try {
        const resultat = await getMessagesProgrammes();
        if (actif) setMessages(resultat);
      } catch (err) {
        if (actif) setErreur(messageErreur(err));
      } finally {
        if (actif) setChargement(false);
      }
    }

    void charger();
    return () => {
      actif = false;
    };
  }, [recharge, version]);

  async function annuler(message: MessageProgramme) {
    if (!window.confirm("Annuler l'envoi programmé ? Le message restera dans les brouillons.")) {
      return;
    }

    setErreur("");
    setAnnulationEnCours(message.idMess);
    try {
      await annulerProgrammation(message.idMess);
      setRecharge((valeur) => valeur + 1);
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setAnnulationEnCours(null);
    }
  }

  async function modifier(message: MessageProgramme) {
    setErreur("");
    setBrouillonEnOuverture(message.idMess);
    try {
      ouvrirBrouillon(await getBrouillon(message.idMess));
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setBrouillonEnOuverture(null);
    }
  }

  const terme = searchTerm.trim().toLowerCase();
  const messagesFiltres = messages.filter((message) => {
    const noms = message.destinataires
      .map((destinataire) => `${destinataire.prenom} ${destinataire.nom}`)
      .join(" ");
    const matricules = message.destinataires
      .map((destinataire) => destinataire.matricule)
      .join(" ");

    const correspondRecherche = !terme
      ? true
      : searchMode === "nom"
        ? noms.toLowerCase().includes(terme)
        : searchMode === "matricule"
          ? matricules.toLowerCase().includes(terme)
          : message.objet.toLowerCase().includes(terme);

    const correspondDate = !dateFilter
      ? true
      : message.dateEnvoiProgramme
        ? new Date(message.dateEnvoiProgramme).toISOString().slice(0, 10) === dateFilter
        : false;

    return correspondRecherche && correspondDate;
  });

  return (
    <section className="programmes-page">
      <header className="mail-header">
        <div>
          <h2>Messages programmés</h2>
          <p>Les messages seront envoyés à la date prévue.</p>
        </div>
        <button type="button" onClick={() => setRecharge((valeur) => valeur + 1)}>
          <RefreshCw size={16} aria-hidden="true" />
          Actualiser
        </button>
      </header>

      {erreur && <p className="mail-error" role="alert">{erreur}</p>}

      {chargement ? (
        <p className="mail-empty">Chargement des messages programmés...</p>
      ) : messagesFiltres.length === 0 ? (
        <p className="mail-empty">
          {messages.length === 0
            ? "Aucun message programmé."
            : "Aucun message ne correspond à la recherche."}
        </p>
      ) : (
        <section className="programmes-list">
          {messagesFiltres.map((message) => (
            <article className="programme-item" key={message.idMess}>
              <div className="programme-item-top">
                <strong>
                  <CalendarClock size={17} aria-hidden="true" />
                  {message.objet || "(Sans objet)"}
                </strong>
                <time dateTime={message.dateEnvoiProgramme}>
                  {afficherDate(message.dateEnvoiProgramme)}
                </time>
              </div>
              <div className="mail-subject">
                À : {message.destinataires.length > 0
                  ? message.destinataires
                      .map((destinataire) =>
                        `${destinataire.prenom} ${destinataire.nom}`.trim() ||
                        destinataire.matricule
                      )
                      .join(", ")
                  : "aucun destinataire"}
              </div>
              {message.nombrePiecesJointes > 0 && (
                <small className="programme-attachments">
                  {message.nombrePiecesJointes} pièce(s) jointe(s)
                </small>
              )}
              <div className="programme-actions">
                <button
                  type="button"
                  className="programme-edit-button"
                  onClick={() => void modifier(message)}
                  disabled={annulationEnCours !== null || brouillonEnOuverture !== null}
                >
                  <Pencil size={16} aria-hidden="true" />
                  {brouillonEnOuverture === message.idMess ? "Ouverture..." : "Modifier"}
                </button>
                <button
                  type="button"
                  onClick={() => void annuler(message)}
                  disabled={annulationEnCours !== null || brouillonEnOuverture !== null}
                >
                  <XCircle size={16} aria-hidden="true" />
                  {annulationEnCours === message.idMess
                    ? "Annulation..."
                    : "Annuler la programmation"}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
