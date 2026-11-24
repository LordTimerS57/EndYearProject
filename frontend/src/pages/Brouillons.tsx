import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { FileText, MailOpen, PenLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getBrouillon,
  getBrouillons,
  getConversation,
  getMessagesProgrammes,
  type BrouillonListe,
  type ConversationDetail,
} from "../services/messageService";
import { useMessagerie } from "./MessagerieContext";
import { useRechercheMessages } from "./useRechercheMessages";
import "./Brouillons.css";

type ConversationBrouillon = {
  conversation?: ConversationDetail;
  erreur?: string;
};

function messageErreur(erreur: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(erreur)) {
    return erreur.response?.data?.message ?? erreur.message;
  }
  return erreur instanceof Error ? erreur.message : "Une erreur est survenue.";
}

function afficherDate(date: string | null): string {
  if (!date) return "Date inconnue";
  const valeur = new Date(date);
  return Number.isNaN(valeur.getTime())
    ? "Date inconnue"
    : valeur.toLocaleString("fr-FR");
}

export default function Brouillons() {
  const navigate = useNavigate();
  const {
    ouvrirNouveauMessage,
    ouvrirBrouillon,
    version,
    searchTerm,
    searchMode,
    dateFilter,
  } = useMessagerie();
  const recherche = useRechercheMessages({
    q: searchTerm,
    mode: searchMode,
    dossier: "brouillons",
    dateFilter,
  });
  const [brouillons, setBrouillons] = useState<BrouillonListe[]>([]);
  const [conversations, setConversations] = useState<Record<number, ConversationBrouillon>>({});
  const [chargement, setChargement] = useState(true);
  const [brouillonEnOuverture, setBrouillonEnOuverture] = useState<number | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur("");

    async function charger() {
      try {
        const [data, messagesProgrammes] = await Promise.all([
          getBrouillons(),
          getMessagesProgrammes(),
        ]);
        if (!actif) return;
        const idsMessagesProgrammes = new Set(
          messagesProgrammes.map((message) => message.idMess)
        );
        const brouillonsDisponibles = data.filter(
          (brouillon) => !idsMessagesProgrammes.has(brouillon.idMess)
        );
        setBrouillons(brouillonsDisponibles);

        const idsConversations = Array.from(
          new Set(
            brouillonsDisponibles
              .filter(
                (brouillon) =>
                  brouillon.idMessParent !== null && brouillon.idMessParent !== undefined
              )
              .map((brouillon) => brouillon.idConv)
          )
        );
        const resultatConversations: Record<number, ConversationBrouillon> = {};

        await Promise.all(
          idsConversations.map(async (idConv) => {
            try {
              resultatConversations[idConv] = {
                conversation: await getConversation(idConv),
              };
            } catch (err: unknown) {
              resultatConversations[idConv] = { erreur: messageErreur(err) };
            }
          })
        );

        if (actif) setConversations(resultatConversations);
      } catch (err: unknown) {
        if (actif) setErreur(messageErreur(err));
      } finally {
        if (actif) setChargement(false);
      }
    }

    void charger();

    return () => {
      actif = false;
    };
  }, [version]);

  async function cliquerBrouillon(brouillon: BrouillonListe) {
    setBrouillonEnOuverture(brouillon.idMess);
    setErreur("");

    try {
      const detail = await getBrouillon(brouillon.idMess);
      if (typeof detail.idMessParent === "number") {
        navigate(`/messagerie/conversation/${detail.idConv}`, {
          state: { depuisBrouillons: true },
        });
      } else {
        ouvrirBrouillon(detail);
      }
    } catch (err: unknown) {
      setErreur(messageErreur(err));
    } finally {
      setBrouillonEnOuverture(null);
    }
  }

  const idsBrouillonsCorrespondants = useMemo(
    () => new Set(recherche.resultats?.map((resultat) => resultat.idMess) ?? []),
    [recherche.resultats]
  );
  const brouillonsFiltres = brouillons.filter(
    (brouillon) =>
      !recherche.active || idsBrouillonsCorrespondants.has(brouillon.idMess)
  );

  return (
    <section className="drafts-page">
      <header className="mail-header">
        <div>
          <h2>Brouillons</h2>
          <p>Les messages non envoyés sont enregistrés ici.</p>
        </div>
        <button onClick={() => ouvrirNouveauMessage()}>
          <PenLine size={16} aria-hidden="true" />
          Nouveau brouillon
        </button>
      </header>

      {erreur && <p className="mail-error" role="alert">{erreur}</p>}
      {recherche.erreur && <p className="mail-error" role="alert">{recherche.erreur}</p>}

      {chargement || recherche.chargement ? (
        <p className="mail-empty">
          {recherche.chargement ? "Recherche des brouillons..." : "Chargement des brouillons..."}
        </p>
      ) : brouillonsFiltres.length === 0 ? (
        <p className="mail-empty">
          {brouillons.length === 0
            ? "Aucun brouillon enregistré."
            : "Aucun brouillon ne correspond à la recherche."}
        </p>
      ) : (
        <section className="drafts-list">
          {brouillonsFiltres.map((brouillon) => {
            const estReponse =
              brouillon.idMessParent !== null && brouillon.idMessParent !== undefined;
            const conversation = estReponse
              ? conversations[brouillon.idConv]?.conversation
              : undefined;
            const erreurConversation = estReponse
              ? conversations[brouillon.idConv]?.erreur
              : undefined;
            const messagesEnvoyes =
              conversation?.messages.filter((message) => message.statut !== "Brouillon") ?? [];
            const dernierMessage = messagesEnvoyes[messagesEnvoyes.length - 1];
            const boutonClassName = estReponse
              ? "mail-item drafts-conversation-item"
              : "drafts-item";

            return (
              <button
                type="button"
                key={brouillon.idMess}
                className={boutonClassName}
                onClick={() => void cliquerBrouillon(brouillon)}
                disabled={brouillonEnOuverture !== null}
              >
                <span className={estReponse ? "mail-item-top" : "drafts-item-header"}>
                  <strong>
                    {estReponse ? (
                      <MailOpen size={16} aria-hidden="true" />
                    ) : (
                      <FileText size={16} aria-hidden="true" />
                    )}
                    {estReponse && <span className="drafts-reply-label">Brouillon</span>}
                    {brouillon.objet || "(Sans objet)"}
                    {estReponse && conversation && conversation.messages.length > 1 && (
                      <span className="mail-count"> ({conversation.messages.length})</span>
                    )}
                  </strong>
                  <small>
                    {brouillonEnOuverture === brouillon.idMess
                      ? "Ouverture..."
                      : afficherDate(brouillon.dateModification ?? brouillon.dateCreation)}
                  </small>
                </span>
                {estReponse ? (
                  <>
                    <span className="mail-subject">
                      {dernierMessage
                        ? `${dernierMessage.expediteur.prenom} ${dernierMessage.expediteur.nom}`
                        : "Conversation"}
                    </span>
                    <p className="drafts-conversation-preview">
                      {brouillon.apercu || "(Brouillon vide)"}
                    </p>
                    {erreurConversation && (
                      <small className="drafts-conversation-error" role="alert">
                        Conversation indisponible : {erreurConversation}
                      </small>
                    )}
                  </>
                ) : (
                  <>
                    <span className="drafts-preview">
                      {brouillon.apercu || "(Brouillon vide)"}
                    </span>
                    <span className="drafts-meta">
                      À : {brouillon.destinataires.length > 0
                        ? brouillon.destinataires
                            .map((d) => (d.prenom || d.nom ? `${d.prenom} ${d.nom}`.trim() : d.matricule))
                            .join(", ")
                        : "aucun destinataire"}
                      {brouillon.nombrePiecesJointes > 0 &&
                        ` · ${brouillon.nombrePiecesJointes} pièce(s) jointe(s)`}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </section>
      )}
    </section>
  );
}
