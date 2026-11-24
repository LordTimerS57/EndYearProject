import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MailOpen, RefreshCw } from "lucide-react";
import {
  getMessagesDossier,
  type Dossier,
  type MessageListe,
} from "../services/messageService";
import { useMessagerie } from "./MessagerieContext";
import { useRechercheMessages } from "./useRechercheMessages";

const TITRES: Record<Dossier, string> = {
  boite: "Boîte de réception",
  envoyes: "Messages envoyés",
  archive: "Archives",
  corbeille: "Corbeille",
};

const MESSAGES_VIDES: Record<Dossier, string> = {
  boite: "Votre boîte de réception est vide.",
  envoyes: "Vous n'avez envoyé aucun message.",
  archive: "Aucun message archivé.",
  corbeille: "La corbeille est vide.",
};

interface ConversationResume {
  idConv: number;
  dernier: MessageListe; // message le plus récent du fil
  nombre: number;
  expireLe: string | null;
}

interface Props {
  dossier?: Dossier;
}

// Page : liste des conversations d'un dossier
export default function ListeMessages({ dossier = "boite" }: Props) {
  const navigate = useNavigate();
  const { version, searchTerm, searchMode, dateFilter } = useMessagerie();
  const recherche = useRechercheMessages({
    q: searchTerm,
    mode: searchMode,
    dossier,
    dateFilter,
  });

  const [messages, setMessages] = useState<MessageListe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [recharge, setRecharge] = useState(0);
  const [maintenant, setMaintenant] = useState(Date.now);

  useEffect(() => {
    const intervalle = window.setInterval(() => setMaintenant(Date.now()), 60_000);
    return () => window.clearInterval(intervalle);
  }, []);

  useEffect(() => {
    let actif = true;

    async function charger() {
      setChargement(true);
      setErreur("");

      try {
        const data = await getMessagesDossier(dossier);
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
        map.set(m.idConv, {
          idConv: m.idConv,
          dernier: m,
          nombre: 1,
          expireLe: m.expireLe ?? null,
        });
      } else {
        existante.nombre++;
        const expireLe = m.expireLe ?? null;
        const echeance = expireLe ? Date.parse(expireLe) : NaN;
        const echeanceExistante = existante.expireLe
          ? Date.parse(existante.expireLe)
          : NaN;

        if (
          Number.isFinite(echeance) &&
          (!Number.isFinite(echeanceExistante) || echeance < echeanceExistante)
        ) {
          existante.expireLe = expireLe;
        }
      }
    }

    const liste = Array.from(map.values());
    const idsConversationsRecherchees = new Set(
      recherche.resultats?.map((resultat) => resultat.idConv) ?? []
    );

    return liste.filter(
      ({ idConv }) =>
        !recherche.active || idsConversationsRecherchees.has(idConv)
    );
  }, [messages, recherche.active, recherche.resultats]);

  function formaterCompteARebours(expireLe: string | null) {
    if (!expireLe) return "Échéance de suppression indisponible";

    const echeance = Date.parse(expireLe);
    if (!Number.isFinite(echeance)) return "Échéance de suppression invalide";

    const minutesRestantes = Math.ceil((echeance - maintenant) / 60_000);
    if (minutesRestantes <= 0) return "Suppression définitive imminente";

    const jours = Math.floor(minutesRestantes / (24 * 60));
    const heures = Math.floor((minutesRestantes % (24 * 60)) / 60);
    const minutes = minutesRestantes % 60;
    const parties: string[] = [];

    if (jours > 0) parties.push(`${jours} j`);
    if (heures > 0) parties.push(`${heures} h`);
    if (minutes > 0 || parties.length === 0) parties.push(`${minutes} min`);

    return `Suppression définitive dans ${parties.join(" ")}`;
  }

  return (
    <>
      <header className="mail-header">
        <h2>{TITRES[dossier]}</h2>
        <button onClick={() => setRecharge((r) => r + 1)}>
          <RefreshCw size={16} aria-hidden="true" />
          Actualiser
        </button>
      </header>

      {erreur && <p className="mail-error">{erreur}</p>}
      {recherche.erreur && <p className="mail-error" role="alert">{recherche.erreur}</p>}

      {chargement || recherche.chargement ? (
        <p className="mail-empty">
          {recherche.chargement ? "Recherche des messages..." : "Chargement des messages..."}
        </p>
      ) : conversations.length === 0 ? (
        <p className="mail-empty">{MESSAGES_VIDES[dossier]}</p>
      ) : (
        <section className="mail-list">
          {conversations.map(({ idConv, dernier, nombre, expireLe }) => (
            <button
              key={idConv}
              className={
                "mail-item " +
                (dossier === "boite" && dernier.statut === "Lu"
                  ? "mail-read"
                  : dossier !== "envoyes" &&
                dossier !== "corbeille" &&
                dernier.statut !== "Lu"
                  ? "mail-unread"
                  : "")
              }
              onClick={() =>
                navigate(`/messagerie/conversation/${idConv}`, { state: { dossier } })
              }
            >
              {dossier === "corbeille" && (
                <small className="mail-countdown" role="timer">
                  {formaterCompteARebours(expireLe)}
                </small>
              )}
              <div className="mail-item-top">
                <strong className="mail-item-title">
                  <MailOpen size={16} aria-hidden="true" />
                  <span>
                    {dernier.objet}
                    {nombre > 1 && <span className="mail-count"> ({nombre})</span>}
                  </span>
                </strong>
                <small>
                  {dernier.dateEnvoi
                    ? new Date(dernier.dateEnvoi).toLocaleDateString("fr-FR")
                    : ""}
                </small>
              </div>
              <div className="mail-subject">
                {dossier === "envoyes"
                  ? `À : ${dernier.destinataires
                      .map((d) => `${d.prenom} ${d.nom}`.trim() || d.matricule)
                      .join(", ")}`
                  : (
                    <>
                      {dossier === "boite" && "De : "}
                      {dernier.expediteur.prenom} {dernier.expediteur.nom}
                    </>
                  )}
              </div>
            </button>
          ))}
        </section>
      )}
    </>
  );
}