import axios from "axios";
import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  Forward,
  Pencil,
  Reply,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  changerEtatConversation,
  getConversation,
  getBrouillon,
  transfererMessage,
  type ConversationDetail,
  type Dossier,
  type EtatCible,
  type MessageConversation,
} from "../services/messageService";
import ApercuFichier from "../components/ApercuFichier";
import { useMessagerie } from "./MessagerieContext";

interface MessageTransfere {
  commentaire: string;
  expediteur: string;
  objet: string;
  date: string;
  contenu: string;
}

function analyserMessageTransfere(contenu: string): MessageTransfere | null {
  const separateur = "---------- Message transféré ----------";
  const position = contenu.indexOf(separateur);
  if (position === -1) return null;

  const commentaire = contenu.slice(0, position).trim();
  const lignes = contenu
    .slice(position + separateur.length)
    .replace(/^\r?\n/, "")
    .split(/\r\n?|\n/);
  const champs: Record<string, string> = {};
  let indexContenu = 0;

  while (indexContenu < lignes.length) {
    const correspondance = lignes[indexContenu].match(/^(De|Objet|Date)\s*:\s*(.*)$/i);
    if (!correspondance) break;
    champs[correspondance[1].toLowerCase()] = correspondance[2];
    indexContenu++;
  }

  if (indexContenu > 0 && lignes[indexContenu] === "") indexContenu++;

  return {
    commentaire,
    expediteur: champs.de ?? "",
    objet: champs.objet ?? "",
    date: champs.date ?? "",
    contenu: lignes.slice(indexContenu).join("\n"),
  };
}

function ContenuMessage({ contenu }: { contenu: string }) {
  const transfert = analyserMessageTransfere(contenu);
  if (!transfert) return <p className="mail-body">{contenu}</p>;

  return (
    <div className="conv-forwarded">
      {transfert.commentaire && (
        <p className="conv-forward-comment">{transfert.commentaire}</p>
      )}
      <section className="conv-forward-card" aria-label="Message transféré">
        <header className="conv-forward-header">
          <Forward size={16} aria-hidden="true" />
          <strong>Message transféré</strong>
        </header>
        <dl className="conv-forward-details">
          {transfert.expediteur && (
            <div>
              <dt>De</dt>
              <dd>{transfert.expediteur}</dd>
            </div>
          )}
          {transfert.objet && (
            <div>
              <dt>Objet</dt>
              <dd>{transfert.objet}</dd>
            </div>
          )}
          {transfert.date && (
            <div>
              <dt>Date</dt>
              <dd>{transfert.date}</dd>
            </div>
          )}
        </dl>
        <div className="conv-forward-body">{transfert.contenu}</div>
      </section>
    </div>
  );
}

// Page : affichage des messages du fil visibles pour l'utilisateur connecté
export default function LectureConversation() {
  const { idConv } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { ouvrirNouveauMessage, ouvrirBrouillon, version } = useMessagerie();
  const depuisBrouillons =
    typeof state === "object" &&
    state !== null &&
    "depuisBrouillons" in state &&
    state.depuisBrouillons === true;

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
  const [brouillonEnOuverture, setBrouillonEnOuverture] = useState<number | null>(null);
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

  function repondre(message: MessageConversation) {
    if (!conversation) return;
    ouvrirNouveauMessage({
      objet: conversation.objet,
      idMessParent: message.idMess,
      initialDestinataire: {
        matricule: message.expediteur.matricule,
        nom: message.expediteur.nom,
        prenom: message.expediteur.prenom,
      },
    });
  }

  async function reprendreBrouillon(idMess: number) {
    setBrouillonEnOuverture(idMess);
    setErreur("");
    try {
      ouvrirBrouillon(await getBrouillon(idMess));
    } catch (err: unknown) {
      setErreur(
        axios.isAxiosError<{ message?: string }>(err)
          ? err.response?.data?.message ?? err.message
          : err instanceof Error
            ? err.message
            : "Impossible d'ouvrir le brouillon."
      );
    } finally {
      setBrouillonEnOuverture(null);
    }
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

  const messagesAffiches = [...(conversation?.messages ?? [])].sort((a, b) => {
    const aBrouillonReponse = a.statut === "Brouillon" && a.idMessParent !== null;
    const bBrouillonReponse = b.statut === "Brouillon" && b.idMessParent !== null;
    return Number(aBrouillonReponse) - Number(bBrouillonReponse);
  });

  return (
    <>
      <header className="mail-header">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft size={16} aria-hidden="true" />
          Retour
        </button>
        {conversation && !depuisBrouillons && (
          <div className="conv-actions">
            {dossier === "archive" ? (
              <>
                <button onClick={() => void deplacer("boite")}>
                  <RotateCcw size={16} aria-hidden="true" />
                  Restaurer
                </button>
                <button
                  className="conv-delete-button"
                  onClick={() => void deplacer("corbeille")}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Supprimer
                </button>
              </>
            ) : dossier === "corbeille" ? (
              <>
                <button onClick={() => void deplacer("boite")}>
                  <RotateCcw size={16} aria-hidden="true" />
                  Restaurer
                </button>
                <button
                  className="conv-delete-button"
                  onClick={() => void deplacer("supprime")}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Supprimer définitivement
                </button>
              </>
            ) : (
              <>
                <button onClick={() => void deplacer("archive")}>
                  <Archive size={16} aria-hidden="true" />
                  Archiver
                </button>
                <button
                  className="conv-delete-button"
                  onClick={() => void deplacer("corbeille")}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Supprimer
                </button>
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
          <h2>Objet : {conversation.objet}</h2>

          {messagesAffiches.map((m) => (
            <article
              key={m.idMess}
              className={`conv-message${
                m.statut === "Brouillon" && m.idMessParent !== null
                  ? " conv-message-draft"
                  : ""
              }`}
            >
              <div className="conv-message-header">
                <strong className="conv-message-sender">
                  {m.statut === "Brouillon" && m.idMessParent !== null && (
                    <span className="conv-draft-badge">Brouillon</span>
                  )}
                  {m.expediteur.prenom} {m.expediteur.nom}
                </strong>
                <small>
                  {m.dateEnvoi ? new Date(m.dateEnvoi).toLocaleString("fr-FR") : ""}
                </small>
              </div>
              <small className="conv-message-meta">
                {m.expediteur.email} → {m.destinataires.join(", ")}
              </small>

              <ContenuMessage contenu={m.contenu} />

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
                  <div className="conv-message-actions">
                    <button
                      type="button"
                      className="mail-reply-btn"
                      onClick={() => repondre(m)}
                    >
                      <Reply size={16} aria-hidden="true" />
                      Répondre
                    </button>
                    <button
                      type="button"
                      className="conv-transfer-button"
                      onClick={() => ouvrirTransfert(m.idMess)}
                    >
                      <Forward size={16} aria-hidden="true" />
                      Transférer ce message
                    </button>
                  </div>
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
                          className="conv-transfer-confirm-button"
                          disabled={transfertEnCours || Boolean(succesTransfert)}
                        >
                          <Forward size={16} aria-hidden="true" />
                          {transfertEnCours ? "Transfert..." : "Confirmer le transfert"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMessageATransferer(null)}
                          disabled={transfertEnCours}
                        >
                          <X size={16} aria-hidden="true" />
                          Fermer
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
              {m.statut === "Brouillon" && m.idMessParent !== null && (
                <button
                  type="button"
                  className="conv-draft-button"
                  onClick={() => void reprendreBrouillon(m.idMess)}
                  disabled={brouillonEnOuverture !== null}
                >
                  <Pencil size={16} aria-hidden="true" />
                  {brouillonEnOuverture === m.idMess
                    ? "Ouverture..."
                    : "Reprendre le brouillon"}
                </button>
              )}
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}