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

    return () => {
      actif = false;
      if (objetUrl) URL.revokeObjectURL(objetUrl);
    };
  }, [piece.idPiece]);

  const handleTelecharger = () => {
    if (!urlFichier) return;
    const a = document.createElement("a");
    a.href = urlFichier;
    a.download = piece.nomFichier;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (chargement)
    return <div className="fichier-loading">Chargement de l'aperçu...</div>;
  if (erreur || !urlFichier)
    return <div className="fichier-erreur">Impossible de charger le fichier.</div>;

  const estImage = piece.typeMime.startsWith("image/");
  const estVideo = piece.typeMime.startsWith("video/");

  return (
    <div
      className="apercu-fichier"
      style={{
        marginTop: "10px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* En-tête : nom + taille */}
      <div
        style={{
          padding: "10px 12px",
          fontSize: "14px",
          fontWeight: "bold",
          borderBottom: "1px solid #eee",
          background: "#fafafa",
        }}
      >
        📎 {piece.nomFichier} ({(piece.tailleFichier / 1024).toFixed(1)} Ko)
      </div>

      {/* Corps : aperçu (image / vidéo / message) */}
      <div style={{ padding: "10px", textAlign: "center" }}>
        {estImage && (
          <img
            src={urlFichier}
            alt={piece.nomFichier}
            style={{ maxWidth: "100%", maxHeight: "400px", borderRadius: "4px" }}
          />
        )}

        {estVideo && (
          <video
            src={urlFichier}
            controls
            style={{ maxWidth: "100%", maxHeight: "400px", borderRadius: "4px" }}
          >
            Votre navigateur ne supporte pas la lecture de vidéos.
          </video>
        )}

        {!estImage && !estVideo && (
          <div style={{ padding: "20px", backgroundColor: "#f5f5f5" }}>
            <p style={{ margin: 0 }}>
              Ce fichier ne peut pas être prévisualisé directement.
            </p>
          </div>
        )}
      </div>

      {/* Pied : bouton de téléchargement à gauche */}
      <div
        style={{
          padding: "10px 12px",
          borderTop: "1px solid #eee",
          background: "#fafafa",
          display: "flex",
          justifyContent: "flex-start", // ⬅️ bouton à gauche
        }}
      >
        <button
          onClick={handleTelecharger}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 12px",
            cursor: "pointer",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          <Download size={16} aria-hidden="true" />
          Télécharger le fichier
        </button>
      </div>
    </div>
  );
}