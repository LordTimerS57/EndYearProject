
import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5182/api";

export interface UtilisateurAdmin {
  matricule: string;
  nom: string;
  prenom: string;
  email: string;
  fonction: string;
  type: string;
  statut: string;
  dateCreation: string;
}

function authHeaders() {
  const token = sessionStorage.getItem("token");

  if (!token) {
    throw new Error("Session administrateur introuvable.");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function getUtilisateursEnAttente() {
  const response = await axios.get<UtilisateurAdmin[]>(
    `${API_URL}/admin/utilisateurs/en-attente`,
    { headers: authHeaders() }
  );

  return response.data;
}

export async function validerUtilisateur(matricule: string) {
  const response = await axios.patch(
    `${API_URL}/admin/utilisateurs/${encodeURIComponent(matricule)}/valider`,
    {},
    { headers: authHeaders() }
  );

  return response.data;
}

export async function refuserUtilisateur(matricule: string) {
  const response = await axios.patch(
    `${API_URL}/admin/utilisateurs/${encodeURIComponent(matricule)}/refuser`,
    {},
    { headers: authHeaders() }
  );

  return response.data;
}
