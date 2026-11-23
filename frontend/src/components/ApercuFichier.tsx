import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { telechargerFichierBlob } from "../services/messageService";
import type { PieceJointe } from "../services/messageService";

interface Props {
  piece: PieceJointe;
}

export default function ApercuFichier({ piece }: Props) {
  const [urlFichier, setUrlFichier] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let objetUrl: string | null = null;
    let actif = true;

    async function charger() {
      try {
        setChargement(true);
        const blob = await telechargerFichierBlob(piece.idPiece);
        if (actif) {
          objetUrl = URL.createObjectURL(blob);
          setUrlFichier(objetUrl);
        }
      } catch {
        if (actif) setErreur(true);
      } finally {
        if (actif) setChargement(false);
      }
    }

    charger();

    // Nettoyage : libérer la mémoire quand le composant est détruit
    return () => {
      actif = false;
      if (objetUrl) URL.revokeObjectURL(objetUrl);
    };
  }, [piece.idPiece]);

  // Fonction pour forcer le téléchargement
  const handleTelecharger = () => {
    if (!urlFichier) return;
    const a = document.createElement("a");
    a.href = urlFichier;
    a.download = piece.nomFichier; // Nom d'origine
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (chargement) return <div className="fichier-loading">Chargement de l'aperçu...</div>;
  if (erreur || !urlFichier) return <div className="fichier-erreur">Impossible de charger le fichier.</div>;

  // Détection du type de fichier
  const estImage = piece.typeMime.startsWith("image/");
  const estVideo = piece.typeMime.startsWith("video/");

  return (
    <div className="apercu-fichier" style={{ marginTop: "10px", border: "1px solid #ddd", padding: "10px", borderRadius: "8px" }}>
      <div style={{ marginBottom: "10px", fontSize: "14px", fontWeight: "bold" }}>
        📎 {piece.nomFichier} ({(piece.tailleFichier / 1024).toFixed(1)} Ko)
      </div>

      {/* Affichage de l'image */}
      {estImage && (
        <img 
          src={urlFichier} 
          alt={piece.nomFichier} 
          style={{ maxWidth: "100%", maxHeight: "400px", borderRadius: "4px" }} 
        />
      )}

      {/* Affichage de la vidéo */}
      {estVideo && (
        <video 
          src={urlFichier} 
          controls 
          style={{ maxWidth: "100%", maxHeight: "400px", borderRadius: "4px" }}
        >
          Votre navigateur ne supporte pas la lecture de vidéos.
        </video>
      )}

      {/* Si ce n'est ni image ni vidéo (ex: PDF, Word, Excel) */}
      {!estImage && !estVideo && (
        <div style={{ padding: "20px", backgroundColor: "#f5f5f5", textAlign: "center" }}>
          <p>Ce fichier ne peut pas être prévisualisé directement.</p>
        </div>
      )}

      {/* Bouton de téléchargement (toujours visible) */}
      <button 
        onClick={handleTelecharger}
        style={{ display: "inline-flex", alignItems: "center", gap: "7px", marginTop: "10px", padding: "8px 12px", cursor: "pointer", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px" }}
      >
        <Download size={16} aria-hidden="true" />
        Télécharger le fichier
      </button>
    </div>
  );
}