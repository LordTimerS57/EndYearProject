import axios from "axios";

let intercepteurInstalle = false;
let redirectionEnCours = false;

export function obtenirExpirationJeton(token: string): number | null {
  const segments = token.split(".");
  if (segments.length !== 3) return null;

  try {
    const contenu = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const contenuRembourre = contenu.padEnd(Math.ceil(contenu.length / 4) * 4, "=");
    const claims: unknown = JSON.parse(window.atob(contenuRembourre));

    if (
      typeof claims !== "object" ||
      claims === null ||
      !("exp" in claims) ||
      typeof claims.exp !== "number" ||
      !Number.isFinite(claims.exp)
    ) {
      return null;
    }

    return claims.exp * 1000;
  } catch {
    return null;
  }
}

export function supprimerSession(): void {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("utilisateur");
}

export function redirigerVersConnexion(): void {
  supprimerSession();

  if (
    !redirectionEnCours &&
    window.location.pathname !== "/login" &&
    window.location.pathname !== "/inscription"
  ) {
    redirectionEnCours = true;
    window.location.replace("/login");
  }
}

export function installerIntercepteurSession(): void {
  if (intercepteurInstalle) return;
  intercepteurInstalle = true;

  axios.interceptors.response.use(
    (response) => response,
    (erreur: unknown) => {
      if (axios.isAxiosError(erreur) && erreur.response?.status === 401) {
        const url = erreur.config?.url ?? "";
        const endpointAuthentification =
          url.includes("/auth/connexion") || url.includes("/auth/inscription");

        if (!endpointAuthentification) redirigerVersConnexion();
      }

      return Promise.reject(erreur);
    }
  );
}
