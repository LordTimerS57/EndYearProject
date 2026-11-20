import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMessagesReception,
  envoyerMessage,
  type MessageReception,
  type EnvoyerMessageData,
} from "../services/messageService";
import "./BoiteReception.css";
import NouveauMessage from "../components/NouveauMessage";
import ApercuFichier from "../components/ApercuFichier";

export default function BoiteReception() {
  const navigate = useNavigate();

  const [messages, setMessages] = useState<MessageReception[]>([]);
  const [selection, setSelection] = useState<MessageReception | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [nouveauMessageOuvert, setNouveauMessageOuvert] = useState(false);

  async function chargerMessages() {
    setChargement(true);
    setErreur("");

    try {
      const data = await getMessagesReception();
      setMessages(data);
    } catch {
      setErreur("Impossible de charger les messages.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    let actif = true;

    async function chargerAuDemarrage() {
      try {
        const data = await getMessagesReception();
        if (actif) {
          setMessages(data);
        }
      } catch {
        if (actif) {
          setErreur("Impossible de charger les messages.");
        }
      } finally {
        if (actif) {
          setChargement(false);
        }
      }
    }

    void chargerAuDemarrage();

    return () => {
      actif = false;
    };
  }, []);

  function deconnexion() {
    sessionStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  // ---------------------------------------------------------
  // Envoi d'un message (intégration avec l'API)
  // ---------------------------------------------------------
 async function gererEnvoi(data: EnvoyerMessageData) {
  try {
    // On stocke le résultat
    const resultat = await envoyerMessage(data);
    
    setNouveauMessageOuvert(false);
    setSelection(null);
    await chargerMessages();

    // ON RETOURNE LE RESULTAT POUR QUE NouveauMessage PUISSE ENVOYER LES FICHIERS
    return resultat; 
  } catch (err: any) {
    const msg = err.response?.data?.message || "Erreur lors de l'envoi du message.";
    throw new Error(msg);
  }
}

  return (
    <div className="mail-layout">
      <aside className="mail-sidebar">
        <h2>Messagerie</h2>

        <button
          className="mail-compose"
          onClick={() => setNouveauMessageOuvert(true)}
        >
          + Nouveau message
        </button>

        <nav>
          <button className="mail-nav-active">Boîte de réception</button>
          <button disabled>Messages envoyés</button>
          <button disabled>Archives</button>
          <button disabled>Corbeille</button>
        </nav>

        <button className="mail-logout" onClick={deconnexion}>
          Déconnexion
        </button>
      </aside>

      <main className="mail-main">
        <header className="mail-header">
          <h2>Boîte de réception</h2>
          <button onClick={chargerMessages}>Actualiser</button>
        </header>

        {erreur && <p className="mail-error">{erreur}</p>}

        {chargement ? (
          <p className="mail-empty">Chargement des messages...</p>
        ) : messages.length === 0 ? (
          <p className="mail-empty">Votre boîte de réception est vide.</p>
        ) : (
          <div className="mail-content">
            <section className="mail-list">
              {messages.map((message) => (
                <button
                  key={message.idMess} // <-- Modifié : idMess au lieu de id
                  className={
                    "mail-item " +
                    (message.statut !== "Lu" ? "mail-unread " : "") + // <-- Modifié : statut au lieu de estLu
                    (selection?.idMess === message.idMess // <-- Modifié
                      ? "mail-selected"
                      : "")
                  }
                  onClick={() => setSelection(message)}
                >
                  <div className="mail-item-top">
                    <strong>
                      {message.expediteur.prenom} {message.expediteur.nom}
                    </strong>
                    <small>
                      {message.dateEnvoi
                        ? new Date(message.dateEnvoi).toLocaleDateString("fr-FR")
                        : ""}
                    </small>
                  </div>
                  <div className="mail-subject">{message.objet}</div>
                  <p>{message.contenu}</p>
                </button>
              ))}
            </section>

            <section className="mail-reader">
              {selection ? (
                <>
                  <h2>{selection.objet}</h2>
                  <p>
                    <strong>De :</strong> {selection.expediteur.prenom}{" "}
                    {selection.expediteur.nom}
                  </p>
                  <p>
                    <strong>Email :</strong> {selection.expediteur.email}
                  </p>

                  {selection.piecesJointes && selection.piecesJointes.length > 0 && (
                    <div style={{ marginTop: "20px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
                      <h4>Pièces jointes ({selection.piecesJointes.length})</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {selection.piecesJointes.map((pj) => (
                          <ApercuFichier key={pj.idPiece} piece={pj} />
                        ))}
                      </div>
                    </div>
                  )}

                  <hr />
                  <p className="mail-body">{selection.contenu}</p>

                  {/* Bouton pour répondre */}
                  <button 
                    className="mail-reply-btn"
                    onClick={() => setNouveauMessageOuvert(true)}
                  >
                    Répondre
                  </button>
                </>
              ) : (
                <p className="mail-empty">
                  Sélectionnez un message pour le lire.
                </p>
              )}
            </section>
          </div>
        )}
      </main>

      {nouveauMessageOuvert && (
        <NouveauMessage
          onClose={() => setNouveauMessageOuvert(false)}
          onEnvoyer={gererEnvoi}
          // On peut passer l'objet et l'idMessParent si on répond à un message
          initialObjet={selection?.objet}
          initialIdMessParent={selection?.idMess} 
        />
      )}
    </div>
  );
}