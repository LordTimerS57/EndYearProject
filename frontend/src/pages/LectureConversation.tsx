import axios from "axios";
import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  changerEtatConversation,
  getConversation,
  transfererMessage,
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
    (state.dossier === "envoyes" ||
      state.dossier === "archive" ||
      state.dossier === "corbeille")
      ? state.dossier
      : "boite";

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [messageATransferer, setMessageATransferer] = useState<number | null>(null);
  const [matriculesDestinataires, setMatriculesDestinataires] = useState("");
  const [commentaireTransfert, setCommentaireTransfert] = useState("");
  const [erreurTransfert, setErreurTransfert] = useState("");
  const [succesTransfert, setSuccesTransfert] = useState("");
  const [transfertEnCours, setTransfertEnCours] = useState(false);

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

  function ouvrirTransfert(idMess: number) {
    setMessageATransferer(idMess);
    setMatriculesDestinataires("");
    setCommentaireTransfert("");
    setErreurTransfert("");
    setSuccesTransfert("");
  }

  async function soumettreTransfert(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (messageATransferer === null) return;

    const destinataires = Array.from(
      new Set(
        matriculesDestinataires
          .split(/[,\n;]+/)
          .map((matricule) => matricule.trim())
          .filter(Boolean)
      )
    );
    if (destinataires.length === 0) {
      setErreurTransfert("Saisissez au moins un matricule destinataire.");
      return;
    }

    setErreurTransfert("");
    setSuccesTransfert("");
    setTransfertEnCours(true);
    try {
      const resultat = await transfererMessage(messageATransferer, {
        matriculesDestinataires: destinataires,
        commentaire: commentaireTransfert,
      });
      setSuccesTransfert(
        `Transfert réussi. Nouveau message : ${resultat.idMessTransfere}.`
      );
    } catch (err: unknown) {
      setErreurTransfert(
        axios.isAxiosError<{ message?: string }>(err)
          ? err.response?.data?.message ?? err.message
          : err instanceof Error
            ? err.message
            : "Le transfert a échoué."
      );
    } finally {
      setTransfertEnCours(false);
    }
  }

  async function deplacer(etat: EtatCible) {
    if (!conversation) return;

    try {
      await changerEtatConversation(conversation.idConv, etat);
      navigate(
        dossier === "envoyes"
          ? etat === "archive"
            ? "/messagerie/archives"
            : "/messagerie/corbeille"
          : "/messagerie/reception",
        { replace: true }
      );
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

              {m.statut !== "Brouillon" && (
                <>
                  <button
                    type="button"
                    className="conv-transfer-button"
                    onClick={() => ouvrirTransfert(m.idMess)}
                  >
                    Transférer ce message
                  </button>
                  {messageATransferer === m.idMess && (
                    <form
                      className="conv-transfer-form"
                      onSubmit={(e) => void soumettreTransfert(e)}
                    >
                      <strong>Transférer le message n°{m.idMess}</strong>
                      <label>
                        Matricules des destinataires
                        <textarea
                          value={matriculesDestinataires}
                          onChange={(e) => setMatriculesDestinataires(e.target.value)}
                          placeholder="ex. 12345, 67890"
                          rows={2}
                          disabled={transfertEnCours}
                        />
                      </label>
                      <small>Séparez les matricules par une virgule, un point-virgule ou une nouvelle ligne.</small>
                      <label>
                        Commentaire (facultatif)
                        <textarea
                          value={commentaireTransfert}
                          onChange={(e) => setCommentaireTransfert(e.target.value)}
                          rows={3}
                          disabled={transfertEnCours}
                        />
                      </label>
                      {erreurTransfert && (
                        <p className="mail-error" role="alert">{erreurTransfert}</p>
                      )}
                      {succesTransfert && (
                        <p className="conv-transfer-success" role="status">{succesTransfert}</p>
                      )}
                      <div className="conv-transfer-actions">
                        <button
                          type="submit"
                          disabled={transfertEnCours || Boolean(succesTransfert)}
                        >
                          {transfertEnCours ? "Transfert..." : "Confirmer le transfert"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMessageATransferer(null)}
                          disabled={transfertEnCours}
                        >
                          Fermer
                        </button>
                      </div>
                    </form>
                  )}
                </>
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