import { useOutletContext } from "react-router-dom";
import type { BrouillonDetail } from "../services/messageService";

export interface OptionsNouveauMessage {
  objet?: string;
  idMessParent?: number;
}

// Données partagées par le layout avec toutes les pages affichées dans <Outlet />
export interface MessagerieContext {
  ouvrirNouveauMessage: (options?: OptionsNouveauMessage) => void;
  ouvrirBrouillon: (brouillon: BrouillonDetail) => void;
  // Incrémenté après un envoi ou une modification de brouillon.
  version: number;
}

export function useMessagerie() {
  return useOutletContext<MessagerieContext>();
}