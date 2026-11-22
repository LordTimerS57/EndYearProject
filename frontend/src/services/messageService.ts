import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5182/api";

function authHeaders() {
  return { Authorization: `Bearer ${sessionStorage.getItem("token")}` };
}

// ---------------------------------------------------------
// 1. TYPES & INTERFACES
// ---------------------------------------------------------

export type Dossier = "boite" | "envoyes" | "archive" | "corbeille";
export type EtatCible = "boite" | "archive" | "corbeille" | "supprime";

export interface PieceJointe {
  idPiece: number;
  nomFichier: string;
  typeMime: string;
  tailleFichier: number;
  dateAjout: string;
}

export interface DestinataireResume {
  matricule: string;
  nom: string;
  prenom: string;
}

// Un message renvoyé par la liste d'un dossier
export interface MessageListe {
  idMess: number;
  idConv: number;
  objet: string;
  contenu: string;
  dateEnvoi: string;
  statut?: string;
  expediteur: {
    matricule: string;
    nom: string;
    prenom: string;
  };
  destinataires: DestinataireResume[];
  expireLe?: string | null;
}

// Un message à l'intérieur d'une conversation
export interface MessageConversation {
  idMess: number;
  contenu: string;
  dateEnvoi: string | null;
  statut: string;
  idMessParent: number | null;
  expediteur: { matricule: string; nom: string; prenom: string; email: string };
  destinataires: string[];
  piecesJointes: PieceJointe[];
}

export interface ConversationDetail {
  idConv: number;
  objet: string;
  dateCreation: string;
  messages: MessageConversation[];
}

export interface EnvoyerMessageData {
  contenu: string;
  objet?: string; // Obligatoire si nouveau message, ignoré si réponse
  idMessParent?: number | null; // Remplir si c'est une réponse
  matriculesDestinataires: string[];
}

export interface UtilisateurRecherche {
  matricule: string;
  nom: string;
  prenom: string;
  fonction: string;
}

// ---------------------------------------------------------
// 2. LISTES ET CONVERSATIONS
// ---------------------------------------------------------

export async function getMessagesDossier(
  dossier: Dossier = "boite"
): Promise<MessageListe[]> {
  if (dossier === "corbeille") {
    return getMessagesCorbeille();
  }

  const response = await axios.get<MessageListe[]>(
    `${API_URL}/messages/reception`,
    { params: { dossier }, headers: authHeaders() }
  );

  if (!Array.isArray(response.data)) {
    throw new Error("La réponse de la liste des messages est invalide.");
  }

  return response.data;
}
export async function getConversation(idConv: number): Promise<ConversationDetail> {
  const response = await axios.get<ConversationDetail>(
    `${API_URL}/messages/conversation/${idConv}`,
    { headers: authHeaders() }
  );
  return response.data;
}

// ---------------------------------------------------------
// 3. ENVOI
// ---------------------------------------------------------

export async function envoyerMessage(data: EnvoyerMessageData) {
  const response = await axios.post(`${API_URL}/messages/envoyer`, data, {
    headers: authHeaders(),
  });
  return response.data;
}

export async function rechercherDestinataires(
  q: string,
  signal?: AbortSignal
): Promise<UtilisateurRecherche[]> {
  const response = await axios.get<UtilisateurRecherche[]>(
    `${API_URL}/messages/destinataires`,
    { params: { q }, headers: authHeaders(), signal }
  );
  return response.data;
}

// ---------------------------------------------------------
// 4. ARCHIVES / CORBEILLE / SUPPRESSION
// ---------------------------------------------------------

export async function changerEtatMessage(idMess: number, etat: EtatCible): Promise<void> {
  await axios.put(`${API_URL}/messages/${idMess}/etat`, { etat }, {
    headers: authHeaders(),
  });
}

export async function changerEtatConversation(idConv: number, etat: EtatCible): Promise<void> {
  await axios.put(`${API_URL}/messages/conversation/${idConv}/etat`, { etat }, {
    headers: authHeaders(),
  });
}

// ---------------------------------------------------------
// 5. PIÈCES JOINTES
// ---------------------------------------------------------

export async function envoyerFichiers(idMess: number, fichiers: FileList) {
  const formData = new FormData();

  Array.from(fichiers).forEach((fichier) => {
    formData.append("fichiers", fichier);
  });

  // Pas de Content-Type manuel : axios ajoute multipart/form-data avec le bon boundary
  const response = await axios.post(
    `${API_URL}/messages/${idMess}/fichiers`,
    formData,
    { headers: authHeaders() }
  );

  return response.data;
}
export async function telechargerFichierBlob(idPiece: number): Promise<Blob> {
  const response = await axios.get(
    `${API_URL}/messages/fichiers/${idPiece}`,
    {
      headers: authHeaders(),
      responseType: "blob", // indispensable : réponse binaire
    }
  );

  return response.data;
}


export interface MessageCorbeille {
  idMess: number;
  idConv: number;
  objet: string;
  contenu: string;
  dateEnvoi: string;
  estMoi: boolean;
  expediteur: { matricule: string; nom: string; prenom: string };
  destinataires: DestinataireResume[];
  dateEtat: string | null;
  expireLe: string | null;
}

export async function getMessagesCorbeille(): Promise<MessageCorbeille[]> {
  const response = await axios.get<MessageCorbeille[]>(
    `${API_URL}/messages/corbeille`,
    { headers: authHeaders() }
  );

  if (!Array.isArray(response.data)) {
    throw new Error("La réponse de la corbeille est invalide.");
  }

  return response.data;
}