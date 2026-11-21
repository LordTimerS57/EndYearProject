import { useEffect, useRef, useState } from "react";
import {
  type EnvoyerMessageData,
  type UtilisateurRecherche,
  rechercherDestinataires,
  envoyerFichiers,
} from "../services/messageService";
import "./NouveauMessage.css";

interface Props {
  onClose: () => void;
  onEnvoyer: (data: EnvoyerMessageData) => Promise<{ idMess: number; idConv: number } | void>;
  initialObjet?: string;
  initialIdMessParent?: number;
}

export default function NouveauMessage({
  onClose,
  onEnvoyer,
  initialObjet = "",
  initialIdMessParent,
}: Props) {
  const [destinataires, setDestinataires] = useState<UtilisateurRecherche[]>([]);
  const [saisie, setSaisie] = useState("");
  const [suggestions, setSuggestions] = useState<UtilisateurRecherche[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [indexActif, setIndexActif] = useState(0);

  const [objet, setObjet] = useState(initialObjet);
  const [contenu, setContenu] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const champRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLUListElement>(null);

  const [fichiers, setFichiers] = useState<FileList | null>(null);

  const estReponse = !!initialIdMessParent;

  const disponibles = suggestions.filter(
    (s) => !destinataires.some((d) => d.matricule === s.matricule)
  );

  useEffect(() => {
    if (!ouvert || estReponse) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setChargement(true);
      try {
        const resultats = await rechercherDestinataires(saisie.trim(), controller.signal);
        setSuggestions(resultats);
        setIndexActif(0);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setChargement(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [saisie, ouvert, estReponse]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (champRef.current && !champRef.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const el = listeRef.current?.children[indexActif] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [indexActif, ouvert]);

  const choisir = (utilisateur: UtilisateurRecherche) => {
    setDestinataires((prev) => [...prev, utilisateur]);
    setSaisie("");
    setIndexActif(0);
    inputRef.current?.focus();
  };

  const retirer = (matricule: string) => {
    setDestinataires((prev) => prev.filter((d) => d.matricule !== matricule));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOuvert(true);
      setIndexActif((i) => Math.min(i + 1, Math.max(disponibles.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndexActif((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault(); 
      if (ouvert && disponibles[indexActif]) choisir(disponibles[indexActif]);
    } else if (e.key === "Escape") {
      setOuvert(false);
    } else if (e.key === "Backspace" && saisie === "" && destinataires.length > 0) {
      setDestinataires((prev) => prev.slice(0, -1));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur("");

    if (!estReponse && destinataires.length === 0) {
      setErreur("Choisissez au moins un destinataire dans la liste.");
      return;
    }

    setEnvoiEnCours(true);

    try {
      const data: EnvoyerMessageData = {
        contenu,
        objet,
        idMessParent: initialIdMessParent || null,
        matriculesDestinataires: destinataires.map((d) => d.matricule),
      };

      const resultat = await onEnvoyer(data);

      if (fichiers && fichiers.length > 0 && resultat && resultat.idMess) {
        await envoyerFichiers(resultat.idMess, fichiers);
      }
    } catch (err: any) {
      setErreur(err.response?.data?.message || err.message || "Erreur lors de l'envoi");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    // Remplacement de modal-overlay par compose-overlay
    <div className="compose-overlay">
      {/* Remplacement de modal-content par compose-window */}
      <div className="compose-window">
        
        {/* Ajout du header avec la classe compose-header */}
        <div className="compose-header">
          <h3>{estReponse ? "Répondre au message" : "Nouveau message"}</h3>
          <button type="button" onClick={onClose} disabled={envoiEnCours}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          
          {!estReponse && (
            <div className="destinataires-wrapper" ref={champRef}>
              <div className="destinataires-champ" onClick={() => inputRef.current?.focus()}>
                {destinataires.map((d) => (
                  <span key={d.matricule} className="destinataire-chip" title={d.matricule}>
                    {d.prenom} {d.nom}
                    <button
                      type="button"
                      onClick={() => retirer(d.matricule)}
                      aria-label={`Retirer ${d.prenom} ${d.nom}`}
                      disabled={envoiEnCours}
                    >
                      ×
                    </button>
                  </span>
                ))}

                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  aria-expanded={ouvert}
                  aria-autocomplete="list"
                  placeholder={
                    destinataires.length === 0
                      ? "À : Rechercher un destinataire (nom, prénom, matricule)…"
                      : "Ajouter un destinataire…"
                  }
                  value={saisie}
                  onChange={(e) => {
                    setSaisie(e.target.value);
                    setOuvert(true);
                  }}
                  onFocus={() => setOuvert(true)}
                  onKeyDown={handleKeyDown}
                  disabled={envoiEnCours}
                  autoComplete="off"
                />
              </div>

              {ouvert && (
                <div className="suggestions">
                  {chargement && <div className="suggestions-info">Recherche…</div>}

                  {!chargement && disponibles.length === 0 && (
                    <div className="suggestions-info">Aucun utilisateur trouvé</div>
                  )}

                  {disponibles.length > 0 && (
                    <ul ref={listeRef} role="listbox">
                      {disponibles.map((u, i) => (
                        <li
                          key={u.matricule}
                          role="option"
                          aria-selected={i === indexActif}
                          className={i === indexActif ? "suggestion actif" : "suggestion"}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            choisir(u);
                          }}
                          onMouseEnter={() => setIndexActif(i)}
                        >
                          <span className="suggestion-nom">
                            {u.prenom} {u.nom}
                          </span>
                          <span className="suggestion-detail">
                            {u.matricule}
                            {u.fonction ? ` · ${u.fonction}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Le champ Objet */}
          <input
            type="text"
            placeholder="Objet"
            value={objet}
            onChange={(e) => setObjet(e.target.value)}
            required={!estReponse}
            disabled={estReponse || envoiEnCours}
          />

          {/* Le champ Contenu */}
          <textarea
            placeholder="Votre message..."
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            required
            disabled={envoiEnCours}
          />

          {/* Le champ de sélection de fichiers (intégré avec un peu de style en ligne pour coller au design) */}
          <div style={{ padding: "10px 0", borderBottom: "1px solid #e5e7eb" }}>
            <input
              type="file"
              multiple
              onChange={(e) => setFichiers(e.target.files)}
              disabled={envoiEnCours}
              style={{ fontSize: "14px", border: "none", padding: "0" }} // On enlève les bordures pour coller au design
            />
            {fichiers && fichiers.length > 0 && (
              <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                📎 {fichiers.length} fichier(s) sélectionné(s)
              </div>
            )}
          </div>

          {/* Le Footer avec les boutons d'action */}
          <div className="compose-footer">
            <button type="submit" className="compose-send" disabled={envoiEnCours}>
              {envoiEnCours ? "Envoi..." : "Envoyer"}
            </button>
            
            <button type="button" className="compose-discard" onClick={onClose} disabled={envoiEnCours}>
              Annuler
            </button>

            {erreur && <span className="compose-error">{erreur}</span>}
          </div>

        </form>
      </div>
    </div>
  );
}