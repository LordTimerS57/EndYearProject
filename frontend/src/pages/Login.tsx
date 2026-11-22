import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

import {
  GraduationCap,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Users,
  AlertCircle,
  LoaderCircle,
  Check,
} from "lucide-react";

import { connexion } from "../services/authService";
import "../styles/login.css";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const [afficherMotDePasse, setAfficherMotDePasse] =
    useState(false);

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (chargement) return;

    setErreur("");
    setChargement(true);

    try {
      const result = await connexion({
        email: email.trim(),
        motDePasse,
      });

      sessionStorage.setItem("token", result.token);

      sessionStorage.setItem(
        "utilisateur",
        JSON.stringify(result.utilisateur)
      );

      if (result.utilisateur.type === "Administrateur") {
        navigate("/admin/dashboard", {
          replace: true,
        });
      } else {
        navigate("/boite-reception", {
          replace: true,
        });
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setErreur(
          error.response?.data?.message ||
            "Impossible de se connecter."
        );
      } else {
        setErreur(
          "Une erreur inattendue est survenue."
        );
      }
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="eni-login-page">

      <aside className="eni-login-sidebar">

        <div className="eni-login-decoration circle-one" />
        <div className="eni-login-decoration circle-two" />
        <div className="eni-login-decoration circle-three" />

        <div className="eni-login-brand">
          <div className="eni-login-brand-icon">
            <GraduationCap size={36} />
          </div>

          <div>
            <h2>ENI</h2>
            <span>Fianarantsoa</span>
          </div>
        </div>

        <div className="eni-login-presentation">

          <div className="eni-login-illustration">

            <div className="eni-login-illustration-ring">

              <div className="eni-login-envelope">
                <Mail size={110} strokeWidth={1.5} />

                <div className="eni-login-envelope-check">
                  <Check size={24} strokeWidth={3} />
                </div>
              </div>

            </div>

          </div>

          <h1>Messagerie interne</h1>

          <p>
            Un espace de communication simple, sécurisé
            et collaboratif pour la communauté de
            l'École Nationale d'Informatique.
          </p>

          <div className="eni-login-features">

            <div className="eni-login-feature">
              <div className="eni-login-feature-icon">
                <ShieldCheck size={22} />
              </div>

              <div>
                <strong>Communication sécurisée</strong>
                <span>
                  Un accès réservé aux utilisateurs autorisés.
                </span>
              </div>
            </div>

            <div className="eni-login-feature">
              <div className="eni-login-feature-icon">
                <Users size={22} />
              </div>

              <div>
                <strong>Collaboration interne</strong>
                <span>
                  Restez connecté avec vos collaborateurs.
                </span>
              </div>
            </div>

          </div>

        </div>

        <div className="eni-login-sidebar-footer">
          École Nationale d'Informatique
          <br />
          Université de Fianarantsoa
        </div>

      </aside>

      <main className="eni-login-main">

        <div className="eni-login-content">

          <div className="eni-login-mobile-brand">
            <GraduationCap size={32} />
            <div>
              <strong>ENI</strong>
              <span>Fianarantsoa</span>
            </div>
          </div>

          <div className="eni-login-icon">
            <Mail size={29} />
          </div>

          <div className="eni-login-heading">
            <h1>Bienvenue !</h1>

            <p>
              Connectez-vous à votre messagerie interne.
            </p>
          </div>

          <form
            className="eni-login-form"
            onSubmit={handleSubmit}
          >

            <div className="eni-login-form-group">

              <label htmlFor="email">
                Adresse email
              </label>

              <div className="eni-login-input-wrapper">
                <Mail
                  size={20}
                  className="eni-login-input-icon"
                />

                <input
                  id="email"
                  type="email"
                  placeholder="Votre adresse email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  autoComplete="email"
                  disabled={chargement}
                  required
                />
              </div>

            </div>

            <div className="eni-login-form-group">

              <label htmlFor="password">
                Mot de passe
              </label>

              <div className="eni-login-input-wrapper">

                <LockKeyhole
                  size={20}
                  className="eni-login-input-icon"
                />

                <input
                  id="password"
                  type={
                    afficherMotDePasse
                      ? "text"
                      : "password"
                  }
                  placeholder="Votre mot de passe"
                  value={motDePasse}
                  onChange={(e) =>
                    setMotDePasse(e.target.value)
                  }
                  autoComplete="current-password"
                  disabled={chargement}
                  required
                />

                <button
                  type="button"
                  className="eni-login-password-toggle"
                  aria-label={
                    afficherMotDePasse
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  onClick={() =>
                    setAfficherMotDePasse(
                      (previous) => !previous
                    )
                  }
                >
                  {afficherMotDePasse ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>

              </div>

            </div>

            {erreur && (
              <div
                className="eni-login-error"
                role="alert"
              >
                <AlertCircle size={20} />
                <span>{erreur}</span>
              </div>
            )}

            <button
              type="submit"
              className="eni-login-submit"
              disabled={chargement}
            >
              {chargement ? (
                <>
                  <LoaderCircle
                    size={20}
                    className="eni-login-spinner"
                  />

                  <span>Connexion en cours...</span>
                </>
              ) : (
                <>
                  <span>Se connecter</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>

          </form>

          <div className="eni-login-divider" />

          <p className="eni-login-register">
            Vous n'avez pas de compte ?{" "}
            <Link to="/inscription">
              Créer un compte
            </Link>
          </p>

        </div>

        <footer className="eni-login-footer">
          © {new Date().getFullYear()} — ENI Fianarantsoa.
          Tous droits réservés.
        </footer>

      </main>

    </div>
  );
}
