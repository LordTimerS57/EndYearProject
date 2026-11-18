
import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5182/api";

export interface InscriptionData {
  matricule: string;
  nom: string;
  prenom: string;
  email: string;
  fonction: string;
  motDePasse: string;
}

export interface ConnexionData {
  email: string;
  motDePasse: string;
}

export const inscription = async (data: InscriptionData) => {
  const response = await axios.post(
    `${API_URL}/auth/inscription`,
    data
  );
  return response.data;
};

export const connexion = async (data: ConnexionData) => {
  const response = await axios.post(
    `${API_URL}/auth/connexion`,
    data
  );
  return response.data;
};
