import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5182/api";

export interface Statistiques {
  total: number;
  supprimes: number;
  actifs: number;
  enAttente: number;
}

export async function getStatistiques(
  signal?: AbortSignal
): Promise<Statistiques> {
  const token = sessionStorage.getItem("token");

  const response = await axios.get<Statistiques>(
    `${API_URL}/admin/statistiques`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal,
    }
  );

  return response.data;
}
