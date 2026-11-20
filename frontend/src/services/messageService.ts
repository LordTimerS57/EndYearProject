import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5182/api";

// ---------------------------------------------------------
// 1. TYPES & INTERFACES
// ---------------------------------------------------------

export interface PieceJointe {
  idPiece: number;
  nomFichier: string;
  typeMime: string;
  tailleFichier: number;
  dateAjout: string;
}

export interface MessageReception {
  idMess: number;
  idConv: number;
  objet: string;
  contenu: string;
  dateEnvoi: string;
  statut: string;
  idMessParent: number | null;
  expediteur: {
    matricule: string;
    nom: string;
    prenom: string;
    email: string;
    fonction: string;
  };
  piecesJointes: PieceJointe[];
}

export interface EnvoyerMessageData {
  contenu: string;
  objet?: string; // Obligatoire si nouveau message, ignoré si réponse
  idMessParent?: number | null; // Remplir si c'est une réponse
  matriculesDestinataires: string[];
}

// ---------------------------------------------------------
// 2. FONCTIONS API
// ---------------------------------------------------------

export async function getMessagesReception(): Promise<MessageReception[]> {
  const token = sessionStorage.getItem("token");

  const response = await axios.get<MessageReception[]>(
    `${API_URL}/messages/reception`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!Array.isArray(response.data)) {
    throw new Error("La réponse de la boîte de réception est invalide.");
  }

  return response.data;
}

export async function envoyerMessage(data: EnvoyerMessageData) {
  const token = sessionStorage.getItem("token");

  const response = await axios.post(
    `${API_URL}/messages/envoyer`,
    data,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}

export interface UtilisateurRecherche {
  matricule: string;
  nom: string;
  prenom: string;
  fonction: string;
}

export async function rechercherDestinataires(
  q: string,
  signal?: AbortSignal
): Promise<UtilisateurRecherche[]> {
  const token = sessionStorage.getItem("token");

  const response = await axios.get<UtilisateurRecherche[]>(
    `${API_URL}/messages/destinataires`,
    {
      params: { q },
      headers: { Authorization: `Bearer ${token}` },
      signal,
    }
  );

  return response.data;
}


export async function envoyerFichiers(idMess: number, fichiers: FileList) {
  const token = sessionStorage.getItem("token");
  const formData = new FormData();

  // Ajouter chaque fichier au FormData
  Array.from(fichiers).forEach((fichier) => {
    formData.append("fichiers", fichier);
  });

  const response = await axios.post(
    `${API_URL}/messages/${idMess}/fichiers`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data", // Important pour les fichiers
      },
    }
  );

  return response.data;
}

export async function telechargerFichierBlob(idPiece: number): Promise<Blob> {
  const token = sessionStorage.getItem("token");
  
  const response = await axios.get(
    `${API_URL}/messages/fichiers/${idPiece}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "blob", // <--- INDISPENSABLE : force axios à traiter la réponse comme un fichier binaire
    }
  );

  return response.data;
}