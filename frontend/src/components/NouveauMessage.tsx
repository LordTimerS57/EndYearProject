import axios from "axios";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Eye, Paperclip, Save, Send, Trash2, X } from "lucide-react";
import {
  envoyerFichiers,
  getBrouillon,
  programmerEnvoi,
  rechercherDestinataires,
  type BrouillonData,
  type BrouillonDetail,
  type BrouillonResultat,
  type DestinataireResume,
  type EnvoyerMessageData,
  type PieceJointe,
  type UtilisateurRecherche,
  telechargerFichierBlob,
} from "../services/messageService";
import "./NouveauMessage.css";

// ---------------------------------------------------------
// Props
// ---------------------------------------------------------
interface Props {
  onClose: () => void;
  onEnvoyer: (data: EnvoyerMessageData) => Promise<{ idMess: number; idConv: number } | void>;
  onSauvegarderBrouillon: (data: BrouillonData, idMess?: number) => Promise<BrouillonResultat>;
  onEnvoyerBrouillon: (idMess: number) => Promise<BrouillonResultat>;
  onSupprimerBrouillon: (idMess: number) => Promise<void>;
  onSupprimerFichierBrouillon: (idMess: number, idPiece: number) => Promise<void>;
  onBrouillonModifie: () => void;
  initialObjet?: string;
  initialIdMessParent?: number;
  initialDestinataire?: DestinataireResume;
  initialBrouillon?: BrouillonDetail;
}

// ---------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------
function messageErreur(erreur: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(erreur)) {
    return erreur.response?.data?.message ?? erreur.message;
  }
  return erreur instanceof Error ? erreur.message : "Une erreur est survenue.";
}

function creerDestinatairesInitiaux(
  brouillon?: BrouillonDetail,
  destinataireInitial?: DestinataireResume
): UtilisateurRecherche[] {
  if (brouillon) {
    return brouillon.destinataires.map((d) => ({
      matricule: d.matricule,
      nom: d.nom || d.matricule,
      prenom: d.prenom || "",
      fonction: "",
    }));
  }

  return destinataireInitial
    ? [
        {
          ...destinataireInitial,
          nom: destinataireInitial.nom || destinataireInitial.matricule,
          fonction: "",
        },
      ]
    : [];
}

function formaterTaille(taille: number): string {
  if (taille < 1024) return `${taille} o`;
  if (taille < 1024 * 1024) return `${(taille / 1024).toFixed(1)} Ko`;
  return `${(taille / (1024 * 1024)).toFixed(1)} Mo`;
}

function initiales(u: UtilisateurRecherche): string {
  const p = (u.prenom || "").trim();
  const n = (u.nom || "").trim();
  if (p && n) return `${p[0]}${n[0]}`.toUpperCase();
  if (p) return p.slice(0, 2).toUpperCase();
  if (n) return n.slice(0, 2).toUpperCase();
  return u.matricule.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------
// Composant
// ---------------------------------------------------------
export default function NouveauMessage({
  onClose,
  onEnvoyer,
  onSauvegarderBrouillon,
  onEnvoyerBrouillon,
  onSupprimerBrouillon,
  onSupprimerFichierBrouillon,
  onBrouillonModifie,
  initialObjet = "",
  initialIdMessParent,
  initialDestinataire,
  initialBrouillon,
}: Props) {
  const navigate = useNavigate();

  // --- État rédaction ---
  const [destinataires, setDestinataires] = useState<UtilisateurRecherche[]>(() =>
    creerDestinatairesInitiaux(initialBrouillon, initialDestinataire)
  );
  const [objet, setObjet] = useState(initialBrouillon?.objet ?? initialObjet);
  const [contenu, setContenu] = useState(initialBrouillon?.contenu ?? "");
  const [piecesExistantes, setPiecesExistantes] = useState<PieceJointe[]>(
    initialBrouillon?.piecesJointes ?? []
  );
  const [fichiers, setFichiers] = useState<File[] | null>(null);
  const [idBrouillon, setIdBrouillon] = useState<number | null>(
    initialBrouillon?.idMess ?? null
  );

  // --- État UI ---
  const [erreur, setErreur] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [dateProgrammation, setDateProgrammation] = useState(() =>
  dateLocalePourChamp(initialBrouillon?.dateEnvoiProgramme)
);  const [pieceEnApercu, setPieceEnApercu] = useState<{
    nomFichier: string;
    typeMime: string;
    url: string;
  } | null>(null);
  const [chargementApercu, setChargementApercu] = useState<number | null>(null);

  // --- Autocomplétion destinataires ---
  const [saisie, setSaisie] = useState("");
  const [suggestions, setSuggestions] = useState<UtilisateurRecherche[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [indexActif, setIndexActif] = useState(0);

  // --- Refs ---
  const champRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLUListElement>(null);
  const fichiersRef = useRef<HTMLInputElement>(null);

  const idMessParent = initialBrouillon?.idMessParent ?? initialIdMessParent ?? null;
  const estReponse = idMessParent !== null;
  const estBrouillon = idBrouillon !== null;

  // ---------------------------------------------------------
  // Effets
  // ---------------------------------------------------------
  useEffect(() => {
    setDestinataires(creerDestinatairesInitiaux(initialBrouillon, initialDestinataire));
    setIdBrouillon(initialBrouillon?.idMess ?? null);
    setObjet(initialBrouillon?.objet ?? initialObjet);
    setContenu(initialBrouillon?.contenu ?? "");
    setPiecesExistantes(initialBrouillon?.piecesJointes ?? []);
    setFichiers(null);
    setDateProgrammation(dateLocalePourChamp(initialBrouillon?.dateEnvoiProgramme));    setErreur("");
    setPieceEnApercu(null);
    if (fichiersRef.current) fichiersRef.current.value = "";
  }, [initialBrouillon, initialDestinataire, initialObjet]);

  useEffect(() => {
    return () => {
      if (pieceEnApercu) URL.revokeObjectURL(pieceEnApercu.url);
    };
  }, [pieceEnApercu]);

  const disponibles = suggestions.filter(
    (s) => !destinataires.some((d) => d.matricule === s.matricule)
  );

  useEffect(() => {
    if (!ouvert) return;
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
  }, [saisie, ouvert]);

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

  // ---------------------------------------------------------
  // Handlers destinataires
  // ---------------------------------------------------------
  function choisir(utilisateur: UtilisateurRecherche) {
    setDestinataires((prev) => [...prev, utilisateur]);
    setSaisie("");
    setIndexActif(0);
    inputRef.current?.focus();
  }

  function retirer(matricule: string) {
    setDestinataires((prev) => prev.filter((d) => d.matricule !== matricule));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
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
  }

  // ---------------------------------------------------------
  // Persistance
  // ---------------------------------------------------------
  function construireDonneesBrouillon(): BrouillonData {
    return {
      objet,
      contenu,
      matriculesDestinataires: destinataires.map((d) => d.matricule),
      idMessParent,
    };
  }

  async function enregistrerBrouillon(): Promise<number> {
    const resultat = await onSauvegarderBrouillon(
      construireDonneesBrouillon(),
      idBrouillon ?? undefined
    );
    setIdBrouillon(resultat.idMess);
    onBrouillonModifie();

    if (fichiers && fichiers.length > 0) {
      await envoyerFichiers(resultat.idMess, fichiers);
      setFichiers(null);
      if (fichiersRef.current) fichiersRef.current.value = "";
      const brouillon = await getBrouillon(resultat.idMess);
      setPiecesExistantes(brouillon.piecesJointes);
      onBrouillonModifie();
    }

    return resultat.idMess;
  }

  async function sauvegarderEtFermer() {
    setErreur("");
    const estNouveauBrouillonVide =
      idBrouillon === null &&
      !objet.trim() &&
      !contenu.trim() &&
      destinataires.length === 0 &&
      piecesExistantes.length === 0 &&
      (fichiers?.length ?? 0) === 0;

    if (estNouveauBrouillonVide) {
      onClose();
      return;
    }

    setEnvoiEnCours(true);
    try {
      await enregistrerBrouillon();
      onClose();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function programmerMessage() {
    setErreur("");

    if (!estReponse && destinataires.length === 0) {
      setErreur("Choisissez au moins un destinataire dans la liste.");
      return;
    }
    if (!estReponse && objet.trim().length === 0) {
      setErreur("L'objet est obligatoire pour programmer l'envoi.");
      return;
    }
    if (contenu.trim().length === 0) {
      setErreur("Le contenu est obligatoire pour programmer l'envoi.");
      return;
    }
    if (!dateProgrammation) {
      setErreur("Choisissez une date et une heure d'envoi.");
      return;
    }

    const date = new Date(dateProgrammation);
    if (!Number.isFinite(date.getTime()) || date.getTime() < Date.now() + 60_000) {
      setErreur("La date d'envoi doit être au moins une minute dans le futur.");
      return;
    }

    setEnvoiEnCours(true);
    try {
      const idMess = await enregistrerBrouillon();
      await programmerEnvoi(idMess, date);
      onBrouillonModifie();
      onClose();
      navigate("/messagerie/programmes");
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreur("");

    if (!estBrouillon && !estReponse && destinataires.length === 0) {
      setErreur("Choisissez au moins un destinataire dans la liste.");
      return;
    }

    setEnvoiEnCours(true);
    try {
      if (estBrouillon) {
        const id = await enregistrerBrouillon();
        await onEnvoyerBrouillon(id);
        return;
      }

      const data: EnvoyerMessageData = {
        contenu,
        objet,
        idMessParent,
        matriculesDestinataires: destinataires.map((d) => d.matricule),
      };
      const resultat = await onEnvoyer(data);

      if (fichiers && fichiers.length > 0 && resultat && resultat.idMess) {
        await envoyerFichiers(resultat.idMess, fichiers);
      }
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoiEnCours(false);
    }
  }


  // Convertit une date ISO (UTC) en valeur compatible <input type="datetime-local">
// (format "YYYY-MM-DDTHH:mm", sans fuseau)
function dateLocalePourChamp(date: string | null | undefined): string {
  if (!date) return "";
  const valeur = new Date(date);
  if (!Number.isFinite(valeur.getTime())) return "";
  valeur.setMinutes(valeur.getMinutes() - valeur.getTimezoneOffset());
  return valeur.toISOString().slice(0, 16);
}

// Borne min : 2 minutes dans le futur
function dateMinimaleProgrammation(): string {
  const date = new Date(Date.now() + 2 * 60_000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}


  // ---------------------------------------------------------
  // Pièces jointes
  // ---------------------------------------------------------
  async function supprimerBrouillon() {
    if (idBrouillon === null) return;
    if (!window.confirm("Supprimer ce brouillon ?")) return;

    setErreur("");
    setEnvoiEnCours(true);
    try {
      await onSupprimerBrouillon(idBrouillon);
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function supprimerPieceJointe(idPiece: number) {
    if (idBrouillon === null) return;
    setErreur("");
    setEnvoiEnCours(true);
    try {
      await onSupprimerFichierBrouillon(idBrouillon, idPiece);
      setPiecesExistantes((pieces) => pieces.filter((piece) => piece.idPiece !== idPiece));
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function visualiserPieceJointe(piece: PieceJointe) {
    setErreur("");
    setChargementApercu(piece.idPiece);
    try {
      const fichier = await telechargerFichierBlob(piece.idPiece);
      setPieceEnApercu({
        nomFichier: piece.nomFichier,
        typeMime: piece.typeMime,
        url: URL.createObjectURL(fichier),
      });
    } catch (err) {
      setErreur(`Impossible de visualiser « ${piece.nomFichier} » : ${messageErreur(err)}`);
    } finally {
      setChargementApercu(null);
    }
  }

  function retirerFichierEnAttente(index: number) {
    const fichiersMisAJour = (fichiers ?? []).filter((_, i) => i !== index);
    setFichiers(fichiersMisAJour.length > 0 ? fichiersMisAJour : null);
    if (fichiersRef.current) fichiersRef.current.value = "";
  }

  function fermerApercu() {
    setPieceEnApercu(null);
  }

  // ---------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------
  const titre = estBrouillon
    ? "Modifier le brouillon"
    : estReponse
      ? "Répondre au message"
      : "Nouveau message";

  const libelleEnvoyer = envoiEnCours
    ? "Enregistrement…"
    : estBrouillon
      ? "Envoyer le brouillon"
      : "Envoyer";

  return (
    <div className="compose-overlay" role="dialog" aria-modal="true" aria-label={titre}>
      <div className="compose-window">
        {/* En-tête */}
        <header className="compose-header">
          <h3>{titre}</h3>
          <button
            type="button"
            className="compose-close"
            onClick={() => void sauvegarderEtFermer()}
            disabled={envoiEnCours}
            aria-label="Enregistrer et fermer"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <form className="compose-form" onSubmit={(e) => void handleSubmit(e)}>
          {/* Destinataires */}
          <div className="destinataires-wrapper" ref={champRef}>
            <div className="destinataires-champ" onClick={() => inputRef.current?.focus()}>
              {destinataires.map((d) => (
                <span key={d.matricule} className="destinataire-chip" title={d.matricule}>
                  <span className="destinataire-avatar">{initiales(d)}</span>
                  <span className="destinataire-nom">
                    {d.prenom ? `${d.prenom} ${d.nom}` : d.nom || d.matricule}
                  </span>
                  <button
                    type="button"
                    onClick={() => retirer(d.matricule)}
                    aria-label={`Retirer ${d.prenom} ${d.nom}`}
                    disabled={envoiEnCours}
                  >
                    <X size={12} aria-hidden="true" />
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
                        <span className="suggestion-avatar">{initiales(u)}</span>
                        <span className="suggestion-textes">
                          <span className="suggestion-nom">
                            {u.prenom} {u.nom}
                          </span>
                          <span className="suggestion-detail">
                            {u.matricule}
                            {u.fonction ? ` · ${u.fonction}` : ""}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Objet */}
          <div className="compose-field">
            <label htmlFor="compose-objet">Objet</label>
            <input
              id="compose-objet"
              type="text"
              placeholder="Objet du message"
              value={objet}
              onChange={(e) => setObjet(e.target.value)}
              required={!estReponse}
              disabled={estReponse || envoiEnCours}
            />
          </div>

          {/* Contenu */}
          <div className="compose-field compose-field--contenu">
            <label htmlFor="compose-contenu">Message</label>
            <textarea
              id="compose-contenu"
              placeholder="Écrivez votre message…"
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              required
              disabled={envoiEnCours}
            />
          </div>

          <div className="compose-field">
            <label htmlFor="compose-date-programmation">Date d'envoi programmé</label>
            <input
              id="compose-date-programmation"
              type="datetime-local"
              min={dateMinimaleProgrammation()}
              value={dateProgrammation}
              onChange={(e) => setDateProgrammation(e.target.value)}
              disabled={envoiEnCours}
            />
          </div>

          {/* Pièces jointes */}
          <div className="compose-attachments">
            <div className="compose-attachments-header">
              <span className="compose-attachments-title">Pièces jointes</span>
              <label className="compose-attach-btn">
                <Paperclip size={16} aria-hidden="true" />
                Joindre un fichier
                <input
                  ref={fichiersRef}
                  type="file"
                  multiple
                  onChange={(e) => {
                    const selection = Array.from(e.target.files ?? []);
                    setFichiers(selection.length > 0 ? selection : null);
                  }}
                  disabled={envoiEnCours}
                />
              </label>
            </div>

            {fichiers && fichiers.length > 0 && (
              <ul className="compose-file-list" aria-label="Nouveaux fichiers sélectionnés">
                {Array.from(fichiers).map((fichier, index) => (
                  <li key={`${fichier.name}-${index}`} className="compose-file compose-file--pending">
                    <div className="compose-file-info">
                      <span className="compose-file-name">{fichier.name}</span>
                      <small>{formaterTaille(fichier.size)} · À joindre</small>
                    </div>
                    <div className="compose-file-actions">
                      <button
                        type="button"
                        className="danger"
                        onClick={() => retirerFichierEnAttente(index)}
                        disabled={envoiEnCours}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        Retirer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {piecesExistantes.length > 0 && (
              <ul className="compose-file-list" aria-label="Fichiers déjà joints">
                {piecesExistantes.map((piece) => (
                  <li key={piece.idPiece} className="compose-file">
                    <div className="compose-file-info">
                      <span className="compose-file-name">{piece.nomFichier}</span>
                      <small>{formaterTaille(piece.tailleFichier)}</small>
                    </div>
                    <div className="compose-file-actions">
                      <button
                        type="button"
                        onClick={() => void visualiserPieceJointe(piece)}
                        disabled={chargementApercu !== null || envoiEnCours}
                      >
                        <Eye size={14} aria-hidden="true" />
                        {chargementApercu === piece.idPiece ? "Chargement…" : "Visualiser"}
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => void supprimerPieceJointe(piece.idPiece)}
                        disabled={envoiEnCours}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        Retirer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Barre d'actions */}
          <footer className="compose-footer">
            {erreur && (
              <span className="compose-error" role="alert">
                {erreur}
              </span>
            )}
            <div className="compose-actions">
              <button type="submit" className="compose-send" disabled={envoiEnCours}>
                <Send size={16} aria-hidden="true" />
                {libelleEnvoyer}
              </button>
              <button
                type="button"
                className="compose-schedule"
                onClick={() => void programmerMessage()}
                disabled={envoiEnCours}
              >
                <CalendarClock size={16} aria-hidden="true" />
                {initialBrouillon?.dateEnvoiProgramme
                  ? "Mettre à jour la programmation"
                  : "Programmer l'envoi"}
              </button>
              <button
                type="button"
                className="compose-save"
                onClick={() => void sauvegarderEtFermer()}
                disabled={envoiEnCours}
              >
                <Save size={16} aria-hidden="true" />
                Enregistrer le brouillon
              </button>
              {estBrouillon && (
                <button
                  type="button"
                  className="compose-discard"
                  onClick={() => void supprimerBrouillon()}
                  disabled={envoiEnCours}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Supprimer
                </button>
              )}
            </div>
          </footer>
        </form>

        {/* Aperçu pièce jointe */}
        {pieceEnApercu && (
          <div className="compose-preview-overlay" role="dialog" aria-modal="true">
            <section className="compose-preview">
              <header>
                <strong title={pieceEnApercu.nomFichier}>{pieceEnApercu.nomFichier}</strong>
                <button type="button" onClick={fermerApercu} aria-label="Fermer l'aperçu">
                  <X size={18} aria-hidden="true" />
                </button>
              </header>
              <div className="compose-preview-content">
                {pieceEnApercu.typeMime.startsWith("image/") ? (
                  <img src={pieceEnApercu.url} alt={pieceEnApercu.nomFichier} />
                ) : pieceEnApercu.typeMime.startsWith("video/") ? (
                  <video src={pieceEnApercu.url} controls />
                ) : pieceEnApercu.typeMime.startsWith("audio/") ? (
                  <audio src={pieceEnApercu.url} controls />
                ) : pieceEnApercu.typeMime === "application/pdf" ||
                  pieceEnApercu.typeMime.startsWith("text/") ? (
                  <iframe src={pieceEnApercu.url} title={pieceEnApercu.nomFichier} sandbox="" />
                ) : (
                  <p>L'aperçu n'est pas disponible pour ce type de fichier.</p>
                )}
              </div>
              <a href={pieceEnApercu.url} download={pieceEnApercu.nomFichier}>
                Télécharger
              </a>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}