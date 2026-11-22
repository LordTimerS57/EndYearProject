import {
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { Link } from "react-router-dom";
import axios from "axios";

import {
  GraduationCap,
  UserPlus,
  User,
  Contact,
  Mail,
  BriefcaseBusiness,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  MessagesSquare,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  ChevronDown,
  Info,
} from "lucide-react";

import { inscription } from "../services/authService";

import "../styles/login.css";
import "../styles/inscription.css";

const initialForm = {
  matricule: "",
  nom: "",
  prenom: "",
  email: "",
  fonction: "",
  motDePasse: "",
  confirmation: "",
};

export default function Inscription() {
  const [form, setForm] = useState(initialForm);

  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [chargement, setChargement] = useState(false);

  const [afficherMotDePasse, setAfficherMotDePasse] =
    useState(false);

  const [afficherConfirmation, setAfficherConfirmation] =
    useState(false);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (chargement) return;

    setErreur("");
    setSucces("");

    if (
      !["Etudiant", "Professeur", "Personnel"].includes(
        form.fonction
      )
    ) {
      setErreur("Veuillez sélectionner une fonction valide.");
      return;
    }

    if (form.motDePasse !== form.confirmation) {
      setErreur("Les mots de passe ne correspondent pas.");
      return;
    }

    if (form.motDePasse.length < 8) {
      setErreur(
        "Le mot de passe doit contenir au moins 8 caractères."
      );
      return;
    }

    setChargement(true);

    try {
      await inscription({
        matricule: form.matricule.trim(),
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        email: form.email.trim(),
        fonction: form.fonction,
        motDePasse: form.motDePasse,
      });

      setSucces(
        "Compte créé avec succès ! Votre inscription est en attente de validation par l'administrateur."
      );

      setForm(initialForm);
      setAfficherMotDePasse(false);
      setAfficherConfirmation(false);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setErreur(
          error.response?.data?.message ||
            "Impossible de créer le compte."
        );
      } else {
        setErreur("Une erreur inattendue est survenue.");
      }
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="eni-login-page eni-register-page">

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

              <div className="eni-register-illustration-card">

                <Contact size={95} strokeWidth={1.5} />

                <div className="eni-login-envelope-check">
                  <UserPlus size={24} strokeWidth={2.5} />
                </div>

              </div>

            </div>

          </div>

          <h1>Rejoignez notre communauté</h1>

          <p>
            Créez votre compte et accédez à la messagerie
            interne de l'École Nationale d'Informatique.
          </p>

          <div className="eni-login-features">

            <div className="eni-login-feature">

              <div className="eni-login-feature-icon">
                <ShieldCheck size={22} />
              </div>

              <div>
                <strong>Accès sécurisé</strong>
                <span>
                  Un espace réservé aux membres de l'ENI.
                </span>
              </div>

            </div>

            <div className="eni-login-feature">

              <div className="eni-login-feature-icon">
                <UserCheck size={22} />
              </div>

              <div>
                <strong>Validation des inscriptions</strong>
                <span>
                  Votre compte est vérifié par un administrateur.
                </span>
              </div>

            </div>

            <div className="eni-login-feature">

              <div className="eni-login-feature-icon">
                <MessagesSquare size={22} />
              </div>

              <div>
                <strong>Communication collaborative</strong>
                <span>
                  Échangez simplement avec les membres de l'ENI.
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

      <main className="eni-login-main eni-register-main">

        <div className="eni-login-content eni-register-content">

          <div className="eni-login-mobile-brand">
            <GraduationCap size={32} />

            <div>
              <strong>ENI</strong>
              <span>Fianarantsoa</span>
            </div>
          </div>

          <div className="eni-login-icon">
            <UserPlus size={29} />
          </div>

          <div className="eni-login-heading">

            <h1>Créer un compte</h1>

            <p>
              Renseignez vos informations pour rejoindre
              la messagerie interne.
            </p>

          </div>

          <form
            className="eni-login-form eni-register-form"
            onSubmit={handleSubmit}
          >

            <div className="eni-login-form-group">

              <label htmlFor="matricule">
                Matricule
              </label>

              <div className="eni-login-input-wrapper">

                <Contact
                  size={20}
                  className="eni-login-input-icon"
                />

                <input
                  id="matricule"
                  name="matricule"
                  type="text"
                  value={form.matricule}
                  onChange={handleChange}
                  placeholder="Votre matricule"
                  disabled={chargement}
                  required
                />

              </div>

            </div>

            <div className="eni-register-row">

              <div className="eni-login-form-group">

                <label htmlFor="nom">
                  Nom
                </label>

                <div className="eni-login-input-wrapper">

                  <User
                    size={20}
                    className="eni-login-input-icon"
                  />

                  <input
                    id="nom"
                    name="nom"
                    type="text"
                    value={form.nom}
                    onChange={handleChange}
                    placeholder="Votre nom"
                    autoComplete="family-name"
                    disabled={chargement}
                    required
                  />

                </div>

              </div>

              <div className="eni-login-form-group">

                <label htmlFor="prenom">
                  Prénom
                </label>

                <div className="eni-login-input-wrapper">

                  <User
                    size={20}
                    className="eni-login-input-icon"
                  />

                  <input
                    id="prenom"
                    name="prenom"
                    type="text"
                    value={form.prenom}
                    onChange={handleChange}
                    placeholder="Votre prénom"
                    autoComplete="given-name"
                    disabled={chargement}
                    required
                  />

                </div>

              </div>

            </div>

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
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Votre adresse email"
                  autoComplete="email"
                  disabled={chargement}
                  required
                />

              </div>

            </div>

            <div className="eni-login-form-group">

              <label htmlFor="fonction">
                Fonction
              </label>

              <div className="eni-login-input-wrapper eni-register-select-wrapper">

                <BriefcaseBusiness
                  size={20}
                  className="eni-login-input-icon"
                />

                <select
                  id="fonction"
                  name="fonction"
                  value={form.fonction}
                  onChange={handleChange}
                  disabled={chargement}
                  required
                >
                  <option value="" disabled>
                    Sélectionnez votre fonction
                  </option>

                  <option value="Etudiant">
                    Étudiant
                  </option>

                  <option value="Professeur">
                    Professeur
                  </option>

                  <option value="Personnel">
                    Personnel
                  </option>
                </select>

                <ChevronDown
                  size={18}
                  className="eni-register-select-arrow"
                />

              </div>

            </div>

            <div className="eni-register-row">

              <div className="eni-login-form-group">

                <label htmlFor="motDePasse">
                  Mot de passe
                </label>

                <div className="eni-login-input-wrapper">

                  <LockKeyhole
                    size={20}
                    className="eni-login-input-icon"
                  />

                  <input
                    id="motDePasse"
                    name="motDePasse"
                    type={
                      afficherMotDePasse
                        ? "text"
                        : "password"
                    }
                    value={form.motDePasse}
                    onChange={handleChange}
                    placeholder="Mot de passe"
                    minLength={8}
                    autoComplete="new-password"
                    aria-describedby="password-hint"
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
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>

                </div>

              </div>

              <div className="eni-login-form-group">

                <label htmlFor="confirmation">
                  Confirmation
                </label>

                <div className="eni-login-input-wrapper">

                  <LockKeyhole
                    size={20}
                    className="eni-login-input-icon"
                  />

                  <input
                    id="confirmation"
                    name="confirmation"
                    type={
                      afficherConfirmation
                        ? "text"
                        : "password"
                    }
                    value={form.confirmation}
                    onChange={handleChange}
                    placeholder="Confirmer"
                    autoComplete="new-password"
                    disabled={chargement}
                    required
                  />

                  <button
                    type="button"
                    className="eni-login-password-toggle"
                    aria-label={
                      afficherConfirmation
                        ? "Masquer la confirmation"
                        : "Afficher la confirmation"
                    }
                    onClick={() =>
                      setAfficherConfirmation(
                        (previous) => !previous
                      )
                    }
                  >
                    {afficherConfirmation ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>

                </div>

              </div>

            </div>

            <p
              id="password-hint"
              className="eni-register-password-hint"
            >
              Le mot de passe doit contenir au moins
              8 caractères.
            </p>

            <div className="eni-register-information">

              <Info size={20} />

              <p>
                Votre compte devra être validé par un
                administrateur avant votre première
                connexion.
              </p>

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

            {succes && (
              <div
                className="eni-register-success"
                role="status"
              >
                <CheckCircle2 size={22} />
                <span>{succes}</span>
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

                  <span>Création en cours...</span>
                </>
              ) : (
                <>
                  <span>Créer mon compte</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>

          </form>

          <div className="eni-login-divider" />

          <p className="eni-login-register">
            Déjà inscrit ?{" "}
            <Link to="/login">
              Se connecter
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
