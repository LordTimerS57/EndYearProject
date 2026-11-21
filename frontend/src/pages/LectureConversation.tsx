import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  changerEtatConversation,
  getConversation,
  type ConversationDetail,
  type Dossier,
  type EtatCible,
} from "../services/messageService";
import ApercuFichier from "../components/ApercuFichier";
import { useMessagerie } from "./MessagerieContext";

// Page : affichage d'une conversation complète (tous les messages du fil)
export default function LectureConversation() {
  const { idConv } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { ouvrirNouveauMessage, version } = useMessagerie();

  const dossier: Dossier =
    typeof state === "object" &&
    state !== null &&
    "dossier" in state &&
    (state.dossier === "archive" || state.dossier === "corbeille")
      ? state.dossier
      : "boite";

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let actif = true;

    async function charger() {
      setChargement(true);
      setErreur("");

      try {
        const data = await getConversation(Number(idConv));
        if (actif) setConversation(data);
      } catch (err: any) {
        if (actif) {
          setConversation(null);
          setErreur(
            err.response?.status === 404
              ? "Conversation introuvable."
              : "Impossible de charger la conversation."
          );
        }
      } finally {
        if (actif) setChargement(false);
      }
    }

    void charger();

    return () => {
      actif = false;
    };
  }, [idConv, version]);

  function repondre() {
    if (!conversation || conversation.messages.length === 0) return;

    // On répond au dernier message du fil (le backend rattache à la même conversation)
    const dernier = conversation.messages[conversation.messages.length - 1];
    ouvrirNouveauMessage({ objet: conversation.objet, idMessParent: dernier.idMess });
  }

  async function deplacer(etat: EtatCible) {
    if (!conversation) return;

    try {
      await changerEtatConversation(conversation.idConv, etat);
      navigate("/messagerie/reception", { replace: true });
    } catch {
      setErreur("Action impossible pour le moment.");
    }
  }

  return (
    <>
      <header className="mail-header">
        <button onClick={() => navigate(-1)}>← Retour</button>
        {conversation && (
          <div className="conv-actions">
            {dossier === "archive" ? (
              <>
                <button onClick={() => void deplacer("boite")}>Restaurer</button>
                <button onClick={() => void deplacer("corbeille")}>Supprimer</button>
              </>
            ) : dossier === "corbeille" ? (
              <>
                <button onClick={() => void deplacer("boite")}>Restaurer</button>
                <button onClick={() => void deplacer("supprime")}>
                  Supprimer définitivement
                </button>
              </>
            ) : (
              <>
                <button onClick={() => void deplacer("archive")}>Archiver</button>
                <button onClick={() => void deplacer("corbeille")}>Supprimer</button>
              </>
            )}
          </div>
        )}
      </header>

      {erreur && <p className="mail-error">{erreur}</p>}

      {chargement ? (
        <p className="mail-empty">Chargement de la conversation...</p>
      ) : conversation ? (
        <section className="mail-reader conv-thread">
          <h2>{conversation.objet}</h2>

          {conversation.messages.map((m) => (
            <article key={m.idMess} className="conv-message">
              <div className="conv-message-header">
                <strong>
                  {m.expediteur.prenom} {m.expediteur.nom}
                </strong>
                <small>
                  {m.dateEnvoi ? new Date(m.dateEnvoi).toLocaleString("fr-FR") : ""}
                </small>
              </div>
              <small className="conv-message-meta">
                {m.expediteur.email} → {m.destinataires.join(", ")}
              </small>

              <p className="mail-body">{m.contenu}</p>

              {m.piecesJointes.length > 0 && (
                <div style={{ marginTop: "12px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
                  <h4>Pièces jointes ({m.piecesJointes.length})</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {m.piecesJointes.map((pj) => (
                      <ApercuFichier key={pj.idPiece} piece={pj} />
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}

          <button className="mail-reply-btn" onClick={repondre}>
            Répondre
          </button>
        </section>
      ) : null}
    </>
  );
}