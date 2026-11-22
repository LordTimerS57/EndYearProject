import axios from "axios";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  envoyerFichiers,
  getBrouillon,
  rechercherDestinataires,
  type BrouillonData,
  type BrouillonDetail,
  type BrouillonResultat,
  type EnvoyerMessageData,
  type PieceJointe,
  type UtilisateurRecherche,
  telechargerFichierBlob,
} from "../services/messageService";
import "./NouveauMessage.css";

interface Props {
  onClose: () => void;
  onEnvoyer: (data: EnvoyerMessageData) => Promise<{ idMess: number; idConv: number } | void>;
  onSauvegarderBrouillon: (
    data: BrouillonData,
    idMess?: number
  ) => Promise<BrouillonResultat>;
  onEnvoyerBrouillon: (idMess: number) => Promise<BrouillonResultat>;
  onSupprimerBrouillon: (idMess: number) => Promise<void>;
  onSupprimerFichierBrouillon: (idMess: number, idPiece: number) => Promise<void>;
  onBrouillonModifie: () => void;
  initialObjet?: string;
  initialIdMessParent?: number;
  initialBrouillon?: BrouillonDetail;
}

function messageErreur(erreur: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(erreur)) {
    return erreur.response?.data?.message ?? erreur.message;
  }
  return erreur instanceof Error ? erreur.message : "Une erreur est survenue.";
}

function creerDestinatairesInitiaux(brouillon?: BrouillonDetail): UtilisateurRecherche[] {
  return brouillon?.matriculesDestinataires.map((matricule) => ({
    matricule,
    nom: matricule,
    prenom: "",
    fonction: "",
  })) ?? [];
}

function formaterTaille(taille: number): string {
  if (taille < 1024) return `${taille} o`;
  if (taille < 1024 * 1024) return `${(taille / 1024).toFixed(1)} Ko`;
  return `${(taille / (1024 * 1024)).toFixed(1)} Mo`;
}

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
  initialBrouillon,
}: Props) {
  const [destinataires, setDestinataires] = useState<UtilisateurRecherche[]>(
    () => creerDestinatairesInitiaux(initialBrouillon)
  );
  const [saisie, setSaisie] = useState("");
  const [suggestions, setSuggestions] = useState<UtilisateurRecherche[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [indexActif, setIndexActif] = useState(0);
  const [idBrouillon, setIdBrouillon] = useState<number | null>(
    initialBrouillon?.idMess ?? null
  );
  const [objet, setObjet] = useState(initialBrouillon?.objet ?? initialObjet);
  const [contenu, setContenu] = useState(initialBrouillon?.contenu ?? "");
  const [piecesExistantes, setPiecesExistantes] = useState<PieceJointe[]>(
    initialBrouillon?.piecesJointes ?? []
  );
  const [erreur, setErreur] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const champRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLUListElement>(null);
  const fichiersRef = useRef<HTMLInputElement>(null);
  const [fichiers, setFichiers] = useState<FileList | null>(null);
  const [pieceEnApercu, setPieceEnApercu] = useState<{
    nomFichier: string;
    typeMime: string;
    url: string;
  } | null>(null);
  const [chargementApercu, setChargementApercu] = useState<number | null>(null);

  const idMessParent = initialBrouillon?.idMessParent ?? initialIdMessParent ?? null;
  const estReponse = idMessParent !== null;
  const estBrouillon = idBrouillon !== null;

  useEffect(() => {
    setDestinataires(creerDestinatairesInitiaux(initialBrouillon));
    setIdBrouillon(initialBrouillon?.idMess ?? null);
    setObjet(initialBrouillon?.objet ?? initialObjet);
    setContenu(initialBrouillon?.contenu ?? "");
    setPiecesExistantes(initialBrouillon?.piecesJointes ?? []);
    setFichiers(null);
    setErreur("");
    setPieceEnApercu(null);
    if (fichiersRef.current) fichiersRef.current.value = "";
  }, [initialBrouillon, initialObjet]);

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

  async function fermer() {
    const objetSaisi = estReponse
      ? objet.trim() !== initialObjet.trim()
      : objet.trim().length > 0;
    const contientDesModifications =
      idBrouillon !== null ||
      objetSaisi ||
      contenu.trim().length > 0 ||
      destinataires.length > 0 ||
      (fichiers?.length ?? 0) > 0;

    if (contientDesModifications) {
      await sauvegarderEtFermer();
    } else {
      onClose();
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
      setErreur(messageErreur(err));
    } finally {
      setChargementApercu(null);
    }
  }

  function fermerApercu() {
    setPieceEnApercu(null);
  }

  return (
    <div className="compose-overlay">
      <div className="compose-window">
        <div className="compose-header">
          <h3>
            {estBrouillon
              ? "Modifier le brouillon"
              : estReponse
                ? "Répondre au message"
                : "Nouveau message"}
          </h3>
          <button type="button" onClick={() => void fermer()} disabled={envoiEnCours}>
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="destinataires-wrapper" ref={champRef}>
            <div className="destinataires-champ" onClick={() => inputRef.current?.focus()}>
              {destinataires.map((d) => (
                <span key={d.matricule} className="destinataire-chip" title={d.matricule}>
                  {d.prenom ? `${d.prenom} ${d.nom}` : d.nom || d.matricule}
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

          <input
            type="text"
            placeholder="Objet"
            value={objet}
            onChange={(e) => setObjet(e.target.value)}
            required={!estReponse}
            disabled={estReponse || envoiEnCours}
          />

          <textarea
            placeholder="Votre message..."
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            required
            disabled={envoiEnCours}
          />

          <div className="compose-attachments">
            <input
              ref={fichiersRef}
              type="file"
              multiple
              onChange={(e) => setFichiers(e.target.files)}
              disabled={envoiEnCours}
            />
            {fichiers && fichiers.length > 0 && (
              <ul className="compose-existing-files" aria-label="Nouveaux fichiers sélectionnés">
                {Array.from(fichiers).map((fichier, index) => (
                  <li key={`${fichier.name}-${index}`}>
                    <span>{fichier.name}</span>
                    <small>{formaterTaille(fichier.size)} · À joindre</small>
                  </li>
                ))}
              </ul>
            )}
            {piecesExistantes.length > 0 && (
              <ul className="compose-existing-files" aria-label="Fichiers déjà joints au brouillon">
                {piecesExistantes.map((piece) => (
                  <li key={piece.idPiece}>
                    <div className="compose-file-info">
                      <span>{piece.nomFichier}</span>
                      <small>{formaterTaille(piece.tailleFichier)}</small>
                    </div>
                    <div className="compose-file-actions">
                      <button
                        type="button"
                        onClick={() => void visualiserPieceJointe(piece)}
                        disabled={chargementApercu !== null || envoiEnCours}
                      >
                        {chargementApercu === piece.idPiece ? "Chargement..." : "Visualiser"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void supprimerPieceJointe(piece.idPiece)}
                        disabled={envoiEnCours}
                      >
                        Retirer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="compose-footer">
            <button type="submit" className="compose-send" disabled={envoiEnCours}>
              {envoiEnCours ? "Enregistrement..." : estBrouillon ? "Envoyer le brouillon" : "Envoyer"}
            </button>
            <button
              type="button"
              className="compose-save"
              onClick={() => void sauvegarderEtFermer()}
              disabled={envoiEnCours}
            >
              Enregistrer le brouillon
            </button>
            {estBrouillon && (
              <button
                type="button"
                className="compose-discard"
                onClick={() => void supprimerBrouillon()}
                disabled={envoiEnCours}
              >
                Supprimer
              </button>
            )}
            <button
              type="button"
              className="compose-discard"
              onClick={() => void fermer()}
              disabled={envoiEnCours}
            >
              Fermer
            </button>
            {erreur && <span className="compose-error">{erreur}</span>}
          </div>
        </form>
        {pieceEnApercu && (
          <div className="compose-preview-overlay" role="dialog" aria-modal="true">
            <section className="compose-preview">
              <header>
                <strong title={pieceEnApercu.nomFichier}>{pieceEnApercu.nomFichier}</strong>
                <button type="button" onClick={fermerApercu} aria-label="Fermer l'aperçu">
                  ×
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
                  <iframe
                    src={pieceEnApercu.url}
                    title={pieceEnApercu.nomFichier}
                    sandbox=""
                  />
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
