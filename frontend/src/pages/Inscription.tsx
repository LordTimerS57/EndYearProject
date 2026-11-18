
import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { inscription } from "../services/authService";

export default function Inscription() {
  const [form, setForm] = useState({
    matricule: "",
    nom: "",
    prenom: "",
    email: "",
    fonction: "",
    motDePasse: "",
    confirmation: "",
  });

  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [chargement, setChargement] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setErreur("");
    setSucces("");

    if (form.motDePasse !== form.confirmation) {
      setErreur("Les mots de passe ne correspondent pas.");
      return;
    }

    if (form.motDePasse.length < 8) {
      setErreur("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setChargement(true);

    try {
      await inscription({
        matricule: form.matricule,
        nom: form.nom,
        prenom: form.prenom,
        email: form.email,
        fonction: form.fonction,
        motDePasse: form.motDePasse,
      });

      setSucces(
        "Compte créé avec succès ! Votre inscription est en attente de validation par l'administrateur."
      );

      setForm({
        matricule: "",
        nom: "",
        prenom: "",
        email: "",
        fonction: "",
        motDePasse: "",
        confirmation: "",
      });
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
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-logo">M</div>

        <h1>Créer un compte</h1>
        <p className="auth-subtitle">
          Rejoignez la messagerie interne de votre organisation.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="matricule">Matricule</label>
            <input
              id="matricule"
              name="matricule"
              value={form.matricule}
              onChange={handleChange}
              placeholder="Ex. EMP001"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nom">Nom</label>
              <input
                id="nom"
                name="nom"
                value={form.nom}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="prenom">Prénom</label>
              <input
                id="prenom"
                name="prenom"
                value={form.prenom}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Adresse email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="fonction">Fonction</label>
            <input
              id="fonction"
              name="fonction"
              value={form.fonction}
              onChange={handleChange}
              placeholder="Ex. Développeur"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="motDePasse">Mot de passe</label>
              <input
                id="motDePasse"
                name="motDePasse"
                type="password"
                value={form.motDePasse}
                onChange={handleChange}
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmation">Confirmer</label>
              <input
                id="confirmation"
                name="confirmation"
                type="password"
                value={form.confirmation}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          {erreur && (
            <div className="alert alert-error" role="alert">
              {erreur}
            </div>
          )}

          {succes && (
            <div className="alert alert-success" role="status">
              {succes}
            </div>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={chargement}
          >
            {chargement ? "Création..." : "Créer mon compte"}
          </button>
        </form>

        <p className="auth-footer">
          Déjà inscrit ? <Link to="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
