import axios from "axios";
import { useEffect, useState } from "react";
import { getBrouillon, getBrouillons, type BrouillonListe } from "../services/messageService";
import { useMessagerie } from "./MessagerieContext";
import "./Brouillons.css";

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
  const { ouvrirNouveauMessage, ouvrirBrouillon, version } = useMessagerie();
  const [brouillons, setBrouillons] = useState<BrouillonListe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [brouillonEnOuverture, setBrouillonEnOuverture] = useState<number | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur("");

    getBrouillons()
      .then((data) => {
        if (actif) setBrouillons(data);
      })
      .catch((err: unknown) => {
        if (actif) setErreur(messageErreur(err));
      })
      .finally(() => {
        if (actif) setChargement(false);
      });

    return () => {
      actif = false;
    };
  }, [version]);

  async function ouvrir(idMess: number) {
    setBrouillonEnOuverture(idMess);
    setErreur("");

    try {
      ouvrirBrouillon(await getBrouillon(idMess));
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setBrouillonEnOuverture(null);
    }
  }

  return (
    <section className="drafts-page">
      <header className="mail-header">
        <div>
          <h2>Brouillons</h2>
          <p>Les messages non envoyés sont enregistrés ici.</p>
        </div>
        <button onClick={() => ouvrirNouveauMessage()}>Nouveau brouillon</button>
      </header>

      {erreur && <p className="mail-error" role="alert">{erreur}</p>}

      {chargement ? (
        <p className="mail-empty">Chargement des brouillons...</p>
      ) : brouillons.length === 0 ? (
        <p className="mail-empty">Aucun brouillon enregistré.</p>
      ) : (
        <section className="drafts-list">
          {brouillons.map((brouillon) => (
            <button
              type="button"
              key={brouillon.idMess}
              className="drafts-item"
              onClick={() => void ouvrir(brouillon.idMess)}
              disabled={brouillonEnOuverture !== null}
            >
              <span className="drafts-item-header">
                <strong>{brouillon.objet || "(Sans objet)"}</strong>
                <small>
                  {brouillonEnOuverture === brouillon.idMess
                    ? "Ouverture..."
                    : afficherDate(brouillon.dateModification ?? brouillon.dateCreation)}
                </small>
              </span>
              <span className="drafts-preview">{brouillon.apercu || "(Brouillon vide)"}</span>
              <span className="drafts-meta">
                À : {brouillon.destinataires.length > 0
                  ? brouillon.destinataires.join(", ")
                  : "aucun destinataire"}
                {brouillon.nombrePiecesJointes > 0 &&
                  ` · ${brouillon.nombrePiecesJointes} pièce(s) jointe(s)`}
              </span>
            </button>
          ))}
        </section>
      )}
    </section>
  );
}
