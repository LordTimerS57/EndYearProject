
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export interface MessageReception {
  id: number;
  expediteur: {
    matricule: string;
    nom: string;
    prenom: string;
    email: string;
  };
  objet: string;
  contenu: string;
  dateEnvoi: string;
  estLu: boolean;
}

export async function getMessagesReception():
  Promise<MessageReception[]> {

  const token = sessionStorage.getItem("token");

  const response = await axios.get<MessageReception[]>(
    `${API_URL}/messages/reception`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
}
