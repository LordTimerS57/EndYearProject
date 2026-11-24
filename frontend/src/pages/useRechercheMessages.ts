import { useEffect, useState } from "react";
import {
  rechercherTousMessages,
  type MessageRecherche,
  type RechercheMessagesParams,
} from "../services/messageService";

type OptionsRecherche = {
  q: string;
  mode: NonNullable<RechercheMessagesParams["mode"]>;
  dossier: NonNullable<RechercheMessagesParams["dossier"]>;
  dateFilter: string;
};

interface EtatRecherche {
  cle: string;
  resultats: MessageRecherche[] | null;
  chargement: boolean;
  erreur: string;
}

export function useRechercheMessages({
  q,
  mode,
  dossier,
  dateFilter,
}: OptionsRecherche) {
  const terme = q.trim();
  const active = Boolean(terme || dateFilter);
  const cle = JSON.stringify([terme, mode, dossier, dateFilter]);
  const [etat, setEtat] = useState<EtatRecherche>({
    cle: "",
    resultats: null,
    chargement: false,
    erreur: "",
  });

  useEffect(() => {
    let actif = true;

    if (!terme && !dateFilter) {
      setEtat({ cle, resultats: null, chargement: false, erreur: "" });
      return () => {
        actif = false;
      };
    }

    setEtat({ cle, resultats: null, chargement: true, erreur: "" });
    const timer = window.setTimeout(() => {
      void rechercherTousMessages({
        q: terme || undefined,
        mode,
        dossier,
        dateDebut: dateFilter || undefined,
        dateFin: dateFilter || undefined,
      })
        .then((resultats) => {
          if (actif) setEtat({ cle, resultats, chargement: false, erreur: "" });
        })
        .catch((erreur: unknown) => {
          if (!actif) return;
          setEtat({
            cle,
            resultats: null,
            chargement: false,
            erreur:
              erreur instanceof Error
                ? erreur.message
                : "Impossible d'effectuer la recherche.",
          });
        });
    }, 250);

    return () => {
      actif = false;
      window.clearTimeout(timer);
    };
  }, [cle, dateFilter, dossier, mode, terme]);

  const etatActuel =
    etat.cle === cle
      ? etat
      : { cle, resultats: null, chargement: active, erreur: "" };

  return {
    active,
    resultats: etatActuel.resultats,
    chargement:
      active &&
      !etatActuel.erreur &&
      (etatActuel.chargement || etatActuel.resultats === null),
    erreur: etatActuel.erreur,
  };
}
