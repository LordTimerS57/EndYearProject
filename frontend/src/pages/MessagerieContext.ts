import { useOutletContext } from "react-router-dom";
import type { BrouillonDetail, DestinataireResume } from "../services/messageService";

export interface OptionsNouveauMessage {
  objet?: string;
  idMessParent?: number;
  initialDestinataire?: DestinataireResume;
}

// Données partagées par le layout avec toutes les pages affichées dans <Outlet />
export interface MessagerieContext {
  ouvrirNouveauMessage: (options?: OptionsNouveauMessage) => void;
  ouvrirBrouillon: (brouillon: BrouillonDetail) => void;
  // Incrémenté après un envoi ou une modification de brouillon.
  version: number;
  searchTerm: string;
  searchMode: "nom" | "matricule" | "objet";
  dateFilter: string;
}

export function useMessagerie() {
  return useOutletContext<MessagerieContext>();
}