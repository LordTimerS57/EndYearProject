1
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { connexion } from "../services/authService";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setErreur("");
    setChargement(true);

    try {
      const result = await connexion({
        email,
        motDePasse,
      });

      sessionStorage.setItem("token", result.token);

      if (result.utilisateur.type === "Administrateur") {
  navigate("/admin/utilisateurs", { replace: true });
} else {
  navigate("/boite-reception", { replace: true });
}
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setErreur(
          error.response?.data?.message ||
            "Impossible de se connecter."
        );
      } else {
        setErreur("Une erreur inattendue est survenue.");
      }
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">M</div>

        <h1>Connexion</h1>
        <p className="auth-subtitle">
          Connectez-vous à votre messagerie interne.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Adresse email</label>
            <input
              id="email"
              type="email"
              placeholder="nom@entreprise.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              placeholder="Votre mot de passe"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {erreur && (
            <div className="alert alert-error" role="alert">
              {erreur}
            </div>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={chargement}
          >
            {chargement ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p className="auth-footer">
          Vous n'avez pas de compte ?{" "}
          <Link to="/inscription">Créer un compte</Link>
        </p>
      </div>
    </div>
  );
}
