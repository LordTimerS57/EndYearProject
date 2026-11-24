import {
  HubConnectionBuilder,
  HubConnectionState,
  type HubConnection,
} from "@microsoft/signalr";
import { useEffect, useRef, useState } from "react";

export interface NotificationMessage {
  idMess: number;
  idConv: number;
  objet: string;
  expediteur: string;
  dateNotification: string;
}

export interface NotificationRecue extends NotificationMessage {
  lue: boolean;
}

interface EtatNotifications {
  notifications: NotificationRecue[];
  erreurConnexion: string;
}

function estNotificationMessage(payload: unknown): payload is NotificationMessage {
  if (typeof payload !== "object" || payload === null) return false;

  return (
    "idMess" in payload &&
    typeof payload.idMess === "number" &&
    "idConv" in payload &&
    typeof payload.idConv === "number" &&
    "objet" in payload &&
    typeof payload.objet === "string" &&
    "expediteur" in payload &&
    typeof payload.expediteur === "string" &&
    "dateNotification" in payload &&
    typeof payload.dateNotification === "string"
  );
}

export function useNotifications(onMessage: (payload: NotificationMessage) => void) {
  const onMessageRef = useRef(onMessage);
  const [etat, setEtat] = useState<EtatNotifications>({
    notifications: [],
    erreurConnexion: "",
  });

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    let actif = true;
    let connexionDemarree: HubConnection | null = null;
    let demarrageDiffere: number | undefined;
    const apiUrl =
      import.meta.env.VITE_API_URL || "http://localhost:5182/api";
    const hubUrl = `${apiUrl.replace(/\/api\/?$/, "")}/hubs/notifications`;

    async function demarrerConnexion() {
      if (!actif) return;

      const connexion = new HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => sessionStorage.getItem("token") ?? "",
          withCredentials: false,
        })
        .withAutomaticReconnect()
        .build();
      connexionDemarree = connexion;

      connexion.on("NouveauMessageRecu", (payload: unknown) => {
        if (!actif || !estNotificationMessage(payload)) return;

        setEtat((precedent) => {
          if (precedent.notifications.some((notification) => notification.idMess === payload.idMess)) {
            return precedent;
          }

          return {
            ...precedent,
            notifications: [
              { ...payload, lue: false },
              ...precedent.notifications,
            ].slice(0, 50),
          };
        });
        onMessageRef.current(payload);
      });

      connexion.onreconnecting(() => {
        if (actif) {
          setEtat((precedent) => ({
            ...precedent,
            erreurConnexion: "Connexion aux notifications interrompue. Reconnexion en cours…",
          }));
        }
      });
      connexion.onreconnected(() => {
        if (actif) {
          setEtat((precedent) => ({ ...precedent, erreurConnexion: "" }));
        }
      });
      connexion.onclose((erreur) => {
        if (actif) {
          setEtat((precedent) => ({
            ...precedent,
            erreurConnexion:
              erreur?.message ?? "La connexion aux notifications est interrompue.",
          }));
        }
      });

      try {
        await connexion.start();
        if (!actif) await connexion.stop();
      } catch (erreur: unknown) {
        if (actif) {
          setEtat((precedent) => ({
            ...precedent,
            erreurConnexion:
              erreur instanceof Error
                ? erreur.message
                : "Impossible de se connecter aux notifications.",
          }));
        }
      }
    }

    demarrageDiffere = window.setTimeout(() => {
      void demarrerConnexion();
    }, 0);

    return () => {
      actif = false;
      if (demarrageDiffere !== undefined) {
        window.clearTimeout(demarrageDiffere);
      }
      if (
        connexionDemarree &&
        connexionDemarree.state !== HubConnectionState.Connecting
      ) {
        void connexionDemarree.stop();
      }
    };
  }, []);

  function marquerCommeLue(idMess: number) {
    setEtat((precedent) => ({
      ...precedent,
      notifications: precedent.notifications.map((notification) =>
        notification.idMess === idMess ? { ...notification, lue: true } : notification
      ),
    }));
  }

  function marquerToutesCommeLues() {
    setEtat((precedent) => ({
      ...precedent,
      notifications: precedent.notifications.map((notification) => ({
        ...notification,
        lue: true,
      })),
    }));
  }

  function effacerNotifications() {
    setEtat((precedent) => ({ ...precedent, notifications: [] }));
  }

  return {
    notifications: etat.notifications,
    nombreNonLues: etat.notifications.filter((notification) => !notification.lue).length,
    erreurConnexion: etat.erreurConnexion,
    marquerCommeLue,
    marquerToutesCommeLues,
    effacerNotifications,
  };
}
