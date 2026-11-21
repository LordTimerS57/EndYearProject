import { useOutletContext } from "react-router-dom";

export interface OptionsNouveauMessage {
  objet?: string;
  idMessParent?: number;
}

// Données partagées par le layout avec toutes les pages affichées dans <Outlet />
export interface MessagerieContext {
  ouvrirNouveauMessage: (options?: OptionsNouveauMessage) => void;
  // Incrémenté après chaque envoi : les pages se rechargent quand il change
  version: number;
}

export function useMessagerie() {
  return useOutletContext<MessagerieContext>();
}