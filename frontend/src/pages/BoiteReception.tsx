
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMessagesReception,
  type MessageReception,
} from "../services/messageService";
import "./BoiteReception.css";
import NouveauMessage from "../components/NouveauMessage";

export default function BoiteReception() {
  const navigate = useNavigate();

  const [messages, setMessages] = useState<MessageReception[]>([]);
  const [selection, setSelection] =
    useState<MessageReception | null>(null);

  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [nouveauMessageOuvert, setNouveauMessageOuvert] =
  useState(false);
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
          <button className="mail-nav-active">
            Boîte de réception
          </button>

          <button disabled>Messages envoyés</button>
          <button disabled>Archives</button>
          <button disabled>Corbeille</button>
        </nav>

        <button
          className="mail-logout"
          onClick={deconnexion}
        >
          Déconnexion
        </button>
      </aside>

      <main className="mail-main">
        <header className="mail-header">
          <h2>Boîte de réception</h2>

          <button onClick={chargerMessages}>
            Actualiser
          </button>
        </header>

        {erreur && (
          <p className="mail-error">{erreur}</p>
        )}

        {chargement ? (
          <p className="mail-empty">
            Chargement des messages...
          </p>
        ) : messages.length === 0 ? (
          <p className="mail-empty">
            Votre boîte de réception est vide.
          </p>
        ) : (
          <div className="mail-content">
            <section className="mail-list">
              {messages.map((message) => (
                <button
                  key={message.id}
                  className={
                    "mail-item " +
                    (!message.estLu ? "mail-unread " : "") +
                    (selection?.id === message.id
                      ? "mail-selected"
                      : "")
                  }
                  onClick={() => setSelection(message)}
                >
                  <div className="mail-item-top">
                    <strong>
                      {message.expediteur.prenom}{" "}
                      {message.expediteur.nom}
                    </strong>

                    <small>
                      {new Date(
                        message.dateEnvoi
                      ).toLocaleDateString("fr-FR")}
                    </small>
                  </div>

                  <div className="mail-subject">
                    {message.objet}
                  </div>

                  <p>{message.contenu}</p>
                </button>
              ))}
            </section>

            <section className="mail-reader">
              {selection ? (
                <>
                  <h2>{selection.objet}</h2>

                  <p>
                    <strong>De :</strong>{" "}
                    {selection.expediteur.prenom}{" "}
                    {selection.expediteur.nom}
                  </p>

                  <p>
                    <strong>Email :</strong>{" "}
                    {selection.expediteur.email}
                  </p>

                  <hr />

                  <p className="mail-body">
                    {selection.contenu}
                  </p>
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
    onEnvoyer={async (message) => {
      console.log("Message à envoyer :", message);

      // À remplacer par l'appel API ASP.NET Core.
      throw new Error("API d'envoi non configurée.");
    }}
  />
)}
    </div>
  );
}
