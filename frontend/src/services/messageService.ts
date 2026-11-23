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

export interface TransfertMessageData {
  matriculesDestinataires: string[];
  commentaire?: string;
}

export interface TransfertMessageResultat {
  message: string;
  idTransfert: number;
  idMessOriginal: number;
  idMessTransfere: number;
  idConv: number;
  destinataires: string[];
  dateTransfert: string;
}

export interface UtilisateurRecherche {
  matricule: string;
  nom: string;
  prenom: string;
  fonction: string;
}

export interface DestinataireDto {
  matricule: string;
  nom: string;
  prenom: string;
}

export interface BrouillonListe {
  idMess: number;
  idConv: number;
  idMessParent?: number | null;
  objet: string;
  apercu: string;
  dateModification: string | null;
  dateCreation: string | null;
  destinataires: DestinataireResume[];
  nombrePiecesJointes: number;
}

export interface BrouillonDetail {
  idMess: number;
  idConv: number;
  objet: string;
  contenu: string;
  destinataires: DestinataireResume[];
  idMessParent: number | null;
  piecesJointes: PieceJointe[];
  dateEnvoiProgramme: string | null;
}

export interface BrouillonData {
  objet: string;
  contenu: string;
  matriculesDestinataires: string[];
  idMessParent: number | null;
}

export interface BrouillonResultat {
  idMess: number;
  idConv: number;
  statut: string;
  message: string;
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

  return response.data.filter((message) => message.statut !== "Brouillon");
}

export async function getBrouillons(): Promise<BrouillonListe[]> {
  const response = await axios.get<BrouillonListe[]>(
    `${API_URL}/messages/brouillons`,
    { headers: authHeaders() }
  );

  if (!Array.isArray(response.data)) {
    throw new Error("La réponse des brouillons est invalide.");
  }

  return response.data;
}

export async function getBrouillon(idMess: number): Promise<BrouillonDetail> {
  const response = await axios.get<BrouillonDetail>(
    `${API_URL}/messages/brouillons/${idMess}`,
    { headers: authHeaders() }
  );
  return response.data;
}

export async function creerBrouillon(data: BrouillonData): Promise<BrouillonResultat> {
  const response = await axios.post<BrouillonResultat>(
    `${API_URL}/messages/brouillons`,
    data,
    { headers: authHeaders() }
  );
  return response.data;
}

export async function modifierBrouillon(
  idMess: number,
  data: BrouillonData
): Promise<BrouillonResultat> {
  const response = await axios.put<BrouillonResultat>(
    `${API_URL}/messages/brouillons/${idMess}`,
    data,
    { headers: authHeaders() }
  );
  return response.data;
}

export async function supprimerBrouillon(idMess: number): Promise<void> {
  await axios.delete(`${API_URL}/messages/brouillons/${idMess}`, {
    headers: authHeaders(),
  });
}

export async function supprimerFichierBrouillon(
  idMess: number,
  idPiece: number
): Promise<void> {
  await axios.delete(`${API_URL}/messages/brouillons/${idMess}/fichiers/${idPiece}`, {
    headers: authHeaders(),
  });
}

export async function envoyerBrouillon(idMess: number): Promise<BrouillonResultat> {
  const response = await axios.post<BrouillonResultat>(
    `${API_URL}/messages/brouillons/${idMess}/envoyer`,
    {},
    { headers: authHeaders() }
  );
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

export async function transfererMessage(
  idMess: number,
  data: TransfertMessageData
): Promise<TransfertMessageResultat> {
  const response = await axios.post<TransfertMessageResultat>(
    `${API_URL}/messages/${idMess}/transferer`,
    data,
    { headers: authHeaders() }
  );
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

export async function envoyerFichiers(idMess: number, fichiers: FileList | File[]) {
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


export async function programmerEnvoi(idMess: number, date: Date): Promise<void> {
  await axios.put(
    `${API_URL}/messages/brouillons/${idMess}/programmation`,
    { dateEnvoiProgramme: date.toISOString() },   // toujours en UTC
    { headers: authHeaders() }
  );
}

export async function annulerProgrammation(idMess: number): Promise<void> {
  await axios.delete(`${API_URL}/messages/brouillons/${idMess}/programmation`, {
    headers: authHeaders(),
  });
}

export interface MessageProgramme {
  idMess: number;
  idConv: number;
  idMessParent: number | null;
  objet: string;
  apercu: string;
  dateEnvoiProgramme: string;
  nombrePiecesJointes: number;
  destinataires: { matricule: string; nom: string; prenom: string }[];
}

export async function getMessagesProgrammes(): Promise<MessageProgramme[]> {
  const response = await axios.get<MessageProgramme[]>(`${API_URL}/messages/programmes`, {
    headers: authHeaders(),
  });
  if (!Array.isArray(response.data)) {
    throw new Error("La réponse des messages programmés est invalide.");
  }
  return response.data;
}


export interface RechercheMessagesParams {
  q?: string;
  dossier?: Dossier | "brouillons";
  dateDebut?: string;   // ISO "YYYY-MM-DD"
  dateFin?: string;
  page?: number;
  taille?: number;
}

export interface MessageRecherche {
  idMess: number;
  idConv: number;
  objet: string;
  contenu: string;
  dateEnvoi: string | null;
  statut: string;
  matriculeExpediteur: string;
  nomExpediteur: string;
  prenomExpediteur: string;
  destinataires: DestinataireResume[];
  dossier: string;
}

export interface RechercheMessagesResultat {
  total: number;
  page: number;
  taille: number;
  elements: MessageRecherche[];
}

export async function rechercherMessages(
  params: RechercheMessagesParams
): Promise<RechercheMessagesResultat> {
  const response = await axios.get<RechercheMessagesResultat>(
    `${API_URL}/messages/recherche`,
    { params, headers: authHeaders() }
  );
  return response.data;
}