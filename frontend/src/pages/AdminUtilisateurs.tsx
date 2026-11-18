
import { useEffect, useState } from "react";
import axios from "axios";
import {
  getUtilisateursEnAttente,
  validerUtilisateur,
  refuserUtilisateur,
  type UtilisateurAdmin,
} from "../services/adminService";

export default function AdminUtilisateurs() {
  const [utilisateurs, setUtilisateurs] =
    useState<UtilisateurAdmin[]>([]);

  const [chargement, setChargement] = useState(true);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const chargerUtilisateurs = async () => {
    try {
      setErreur("");
      const data = await getUtilisateursEnAttente();
      setUtilisateurs(data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setErreur(
          error.response?.data?.message ||
            "Impossible de charger les utilisateurs."
        );
      } else {
        setErreur("Une erreur est survenue.");
      }
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    void chargerUtilisateurs();
  }, []);

  const traiterUtilisateur = async (
    matricule: string,
    action: "valider" | "refuser"
  ) => {
    const confirmation = window.confirm(
      `Voulez-vous vraiment ${action} ce compte ?`
    );

    if (!confirmation) return;

    setActionEnCours(matricule);
    setErreur("");
    setSucces("");

    try {
      if (action === "valider") {
        await validerUtilisateur(matricule);
        setSucces("Compte validé avec succès.");
      } else {
       const resultat = await refuserUtilisateur(matricule);

if (resultat.emailEnvoye) {
  setSucces(
    "Inscription refusée. Un email de notification a été envoyé."
  );
} else {
  setSucces(
    "Inscription refusée, mais la notification email n'a pas pu être envoyée."
  );
}
      }

      await chargerUtilisateurs();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setErreur(
          error.response?.data?.message ||
            "Impossible de traiter la demande."
        );
      } else {
        setErreur("Une erreur est survenue.");
      }
    } finally {
      setActionEnCours(null);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="admin-header">
          <div>
            <h1>Gestion des utilisateurs</h1>
            <p>
              Consultez et gérez les demandes d'inscription.
            </p>
          </div>

          <button
            className="admin-refresh"
            onClick={() => void chargerUtilisateurs()}
          >
            Actualiser
          </button>
        </div>

        <div className="admin-stat">
          <span>Demandes en attente</span>
          <strong>{utilisateurs.length}</strong>
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

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Utilisateur</th>
                <th>Email</th>
                <th>Fonction</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {chargement ? (
                <tr>
                  <td colSpan={6}>Chargement...</td>
                </tr>
              ) : utilisateurs.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    Aucune demande en attente.
                  </td>
                </tr>
              ) : (
                utilisateurs.map((u) => (
                  <tr key={u.matricule}>
                    <td>{u.matricule}</td>
                    <td>{u.prenom} {u.nom}</td>
                    <td>{u.email}</td>
                    <td>{u.fonction}</td>
                    <td>
                      <span className="admin-status">
                        {u.statut}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="btn-validate"
                          disabled={actionEnCours !== null}
                          onClick={() =>
                            void traiterUtilisateur(
                              u.matricule,
                              "valider"
                            )
                          }
                        >
                          Valider
                        </button>

                        <button
                          className="btn-reject"
                          disabled={actionEnCours !== null}
                          onClick={() =>
                            void traiterUtilisateur(
                              u.matricule,
                              "refuser"
                            )
                          }
                        >
                          Refuser
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
