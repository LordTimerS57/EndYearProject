
import { useState } from "react";
import type { FormEvent } from "react";
import "./NouveauMessage.css";

interface Props {
  onClose: () => void;
  onEnvoyer: (message: {
    destinataire: string;
    objet: string;
    contenu: string;
  }) => Promise<void>;
}

export default function NouveauMessage({
  onClose,
  onEnvoyer,
}: Props) {
  const [destinataire, setDestinataire] = useState("");
  const [objet, setObjet] = useState("");
  const [contenu, setContenu] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!destinataire.trim() || !contenu.trim()) {
      setErreur("Renseignez le destinataire et le message.");
      return;
    }

    setEnvoi(true);
    setErreur("");

    try {
      await onEnvoyer({
        destinataire: destinataire.trim(),
        objet: objet.trim(),
        contenu: contenu.trim(),
      });
      onClose();
    } catch {
      setErreur("Impossible d'envoyer le message.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div
      className="compose-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !envoi) {
          onClose();
        }
      }}
    >
      <section
        className="compose-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-title"
      >
        <header className="compose-header">
          <h3 id="compose-title">Nouveau message</h3>

          <button
            type="button"
            onClick={onClose}
            disabled={envoi}
            aria-label="Fermer"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="À : adresse du destinataire"
            value={destinataire}
            onChange={(e) => setDestinataire(e.target.value)}
            required
            disabled={envoi}
          />

          <input
            type="text"
            placeholder="Objet"
            value={objet}
            onChange={(e) => setObjet(e.target.value)}
            disabled={envoi}
          />

          <textarea
            placeholder="Rédigez votre message..."
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            required
            disabled={envoi}
          />

          {erreur && <p className="compose-error">{erreur}</p>}

          <footer className="compose-footer">
            <button
              type="submit"
              className="compose-send"
              disabled={envoi}
            >
              {envoi ? "Envoi en cours..." : "Envoyer"}
            </button>

            <button
              type="button"
              className="compose-discard"
              onClick={onClose}
              disabled={envoi}
            >
              Annuler
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
