import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMessagesReception,
  type Dossier,
  type MessageReception,
} from "../services/messageService";
import { useMessagerie } from "./MessagerieContext";

const TITRES: Record<Dossier, string> = {
  boite: "Boîte de réception",
  archive: "Archives",
  corbeille: "Corbeille",
};

const MESSAGES_VIDES: Record<Dossier, string> = {
  boite: "Votre boîte de réception est vide.",
  archive: "Aucun message archivé.",
  corbeille: "La corbeille est vide.",
};

interface ConversationResume {
  idConv: number;
  dernier: MessageReception; // message le plus récent du fil
  nombre: number;
}

interface Props {
  dossier?: Dossier;
}

// Page : liste des conversations d'un dossier (boîte, archives, corbeille)
export default function BoiteReception({ dossier = "boite" }: Props) {
  const navigate = useNavigate();
  const { version } = useMessagerie();

  const [messages, setMessages] = useState<MessageReception[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [recharge, setRecharge] = useState(0);

  useEffect(() => {
    let actif = true;

    async function charger() {
      setChargement(true);
      setErreur("");

      try {
        const data = await getMessagesReception(dossier);
        if (actif) setMessages(data);
      } catch {
        if (actif) setErreur("Impossible de charger les messages.");
      } finally {
        if (actif) setChargement(false);
      }
    }

    void charger();

    return () => {
      actif = false;
    };
  }, [dossier, version, recharge]);

  // Un seul élément par conversation (comme Gmail).
  // L'API renvoie les messages du plus récent au plus ancien :
  // le premier rencontré est donc le dernier du fil.
  const conversations = useMemo(() => {
    const map = new Map<number, ConversationResume>();

    for (const m of messages) {
      const existante = map.get(m.idConv);
      if (!existante) {
        map.set(m.idConv, { idConv: m.idConv, dernier: m, nombre: 1 });
      } else {
        existante.nombre++;
      }
    }

    return Array.from(map.values());
  }, [messages]);

  return (
    <>
      <header className="mail-header">
        <h2>{TITRES[dossier]}</h2>
        <button onClick={() => setRecharge((r) => r + 1)}>Actualiser</button>
      </header>

      {erreur && <p className="mail-error">{erreur}</p>}

      {chargement ? (
        <p className="mail-empty">Chargement des messages...</p>
      ) : conversations.length === 0 ? (
        <p className="mail-empty">{MESSAGES_VIDES[dossier]}</p>
      ) : (
        <section className="mail-list">
          {conversations.map(({ idConv, dernier, nombre }) => (
            <button
              key={idConv}
              className={"mail-item " + (dernier.statut !== "Lu" ? "mail-unread" : "")}
              onClick={() =>
                navigate(`/messagerie/conversation/${idConv}`, { state: { dossier } })
              }
            >
              <div className="mail-item-top">
                <strong>
                  {dernier.objet}
                  {nombre > 1 && <span className="mail-count"> ({nombre})</span>}
                </strong>
                <small>
                  {dernier.dateEnvoi
                    ? new Date(dernier.dateEnvoi).toLocaleDateString("fr-FR")
                    : ""}
                </small>
              </div>
              <div className="mail-subject">
                {dernier.expediteur.prenom} {dernier.expediteur.nom}
              </div>
              <p>{dernier.contenu}</p>
            </button>
          ))}
        </section>
      )}
    </>
  );
}