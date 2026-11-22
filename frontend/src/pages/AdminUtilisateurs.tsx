import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  UserPlus,
  RefreshCw,
  Search,
  Check,
  X,
  Clock,
  Inbox,
} from "lucide-react";

import {
  getUtilisateursEnAttente,
  validerUtilisateur,
  refuserUtilisateur,
  type UtilisateurAdmin,
} from "../services/adminService";
import "../styles/admin.css"
import "../components/admin/AdminSidebar"
import "../components/admin/AdminHeader"
import "../components/admin/AdminLayout"

export default function AdminInscriptions() {
  const [utilisateurs, setUtilisateurs] =
    useState<UtilisateurAdmin[]>([]);

  const [chargement, setChargement] = useState(true);
  const [actionEnCours, setActionEnCours] =
    useState<string | null>(null);

  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const chargerUtilisateurs = useCallback(async () => {
    setChargement(true);
    setErreur("");

    try {
      const data = await getUtilisateursEnAttente();
      setUtilisateurs(data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setErreur(
          error.response?.data?.message ||
            "Impossible de charger les inscriptions."
        );
      } else {
        setErreur("Une erreur est survenue.");
      }
    } finally {
      setChargement(false);
    }
  }, []);

useEffect(() => {
  let ignore = false;

  getUtilisateursEnAttente()
    .then((data) => {
      if (!ignore) {
        setUtilisateurs(data);
        setErreur("");
      }
    })
    .catch((error: unknown) => {
      if (ignore) return;

      if (axios.isAxiosError(error)) {
        setErreur(
          error.response?.data?.message ||
            "Impossible de charger les inscriptions."
        );
      } else {
        setErreur("Une erreur est survenue.");
      }
    })
    .finally(() => {
      if (!ignore) {
        setChargement(false);
      }
    });

  return () => {
    ignore = true;
  };
}, []);

  const traiterUtilisateur = async (
    matricule: string,
    action: "valider" | "refuser"
  ) => {
    const confirmation = window.confirm(
      `Voulez-vous vraiment ${action} cette inscription ?`
    );

    if (!confirmation) return;

    setActionEnCours(matricule);
    setErreur("");
    setSucces("");

    try {
      if (action === "valider") {
        await validerUtilisateur(matricule);

        setSucces("Inscription validée avec succès.");
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

      setUtilisateurs((precedents) =>
        precedents.filter(
          (utilisateur) =>
            utilisateur.matricule !== matricule
        )
      );

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

  const utilisateursFiltres = utilisateurs.filter((u) => {
    const terme = recherche.trim().toLowerCase();

    const informations = [
      u.matricule,
      u.nom,
      u.prenom,
      u.email,
      u.fonction,
    ]
      .join(" ")
      .toLowerCase();

    return informations.includes(terme);
  });

  return (
    <div className="admin-inscriptions">

      <div className="admin-page-heading">
        <h1>Gestion des inscriptions</h1>
        <p>
          Consultez et traitez les nouvelles demandes
          d'inscription à la messagerie interne.
        </p>
      </div>

      <div className="admin-inscription-summary">

        <div className="admin-stat-icon yellow">
          <UserPlus size={27} />
        </div>

        <div className="admin-inscription-summary-info">
          <span>Demandes en attente</span>
          <strong>
            {chargement ? "—" : utilisateurs.length}
          </strong>
        </div>

        <div className="admin-pending-label">
          <Clock size={15} />
          En attente de validation
        </div>

      </div>

      {erreur && (
        <div className="admin-error" role="alert">
          {erreur}
        </div>
      )}

      {succes && (
        <div className="admin-success" role="status">
          <Check size={19} />
          <span>{succes}</span>
        </div>
      )}

      <div className="admin-table-card">

        <div className="admin-table-heading">
          <div>
            <h2>Demandes d'inscription</h2>
            <p>
              Liste des comptes en attente de validation.
            </p>
          </div>

          <button
            className="admin-refresh-button"
            disabled={chargement || actionEnCours !== null}
            onClick={() => void chargerUtilisateurs()}
          >
            <RefreshCw
              size={17}
              className={chargement ? "admin-spin" : ""}
            />
            Actualiser
          </button>
        </div>

        <div className="admin-table-toolbar">

          <div className="admin-search-wrapper">
            <Search size={19} />

            <input
              type="search"
              placeholder="Rechercher un utilisateur..."
              aria-label="Rechercher un utilisateur"
              value={recherche}
              onChange={(e) =>
                setRecherche(e.target.value)
              }
            />
          </div>

          <span className="admin-result-count">
            {utilisateursFiltres.length} résultat(s)
          </span>

        </div>

        <div className="admin-table-scroll">
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
                  <td colSpan={6}>
                    <div className="admin-empty-state">
                      <RefreshCw
                        size={30}
                        className="admin-spin"
                      />
                      <p>Chargement des inscriptions...</p>
                    </div>
                  </td>
                </tr>
              ) : erreur && utilisateurs.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="admin-empty-state">
                      <X size={30} />
                      <p>Chargement impossible.</p>
                    </div>
                  </td>
                </tr>
              ) : utilisateursFiltres.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="admin-empty-state">
                      <Inbox size={38} />

                      <h3>
                        {recherche
                          ? "Aucun résultat"
                          : "Aucune demande en attente"}
                      </h3>

                      <p>
                        {recherche
                          ? "Essayez une autre recherche."
                          : "Les nouvelles inscriptions apparaîtront ici."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                utilisateursFiltres.map((u) => (
                  <tr key={u.matricule}>

                    <td className="admin-matricule">
                      {u.matricule}
                    </td>

                    <td>
                      <div className="admin-user-cell">

                        <div className="admin-user-avatar">
                          {u.prenom?.charAt(0).toUpperCase()}
                          {u.nom?.charAt(0).toUpperCase()}
                        </div>

                        <span>
                          {u.prenom} {u.nom}
                        </span>

                      </div>
                    </td>

                    <td>{u.email}</td>

                    <td>{u.fonction}</td>

                    <td>
                      <span className="admin-status-badge pending">
                        <Clock size={13} />
                        {u.statut}
                      </span>
                    </td>

                    <td>
                      <div className="admin-table-actions">

                        <button
                          className="admin-action-button validate"
                          disabled={actionEnCours !== null}
                          onClick={() =>
                            void traiterUtilisateur(
                              u.matricule,
                              "valider"
                            )
                          }
                        >
                          <Check size={16} />
                          Valider
                        </button>

                        <button
                          className="admin-action-button reject"
                          disabled={actionEnCours !== null}
                          onClick={() =>
                            void traiterUtilisateur(
                              u.matricule,
                              "refuser"
                            )
                          }
                        >
                          <X size={16} />
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