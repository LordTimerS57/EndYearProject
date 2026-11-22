import { useEffect, useState } from "react";
import {
  Users,
  UserX,
  UserCheck,
  Clock,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  getStatistiques,
  type Statistiques,
} from "../services/dashboardService";

export default function AdminDashboard() {
  const [stats, setStats] = useState<Statistiques>({
    total: 0,
    supprimes: 0,
    actifs: 0,
    enAttente: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    getStatistiques(controller.signal)
      .then((data) => {
        setStats(data);
        setError("");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(
            "Impossible de récupérer les statistiques."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const cards = [
    {
      title: "Nombre total d'utilisateurs",
      value: stats.total,
      icon: Users,
      color: "green",
    },
    {
      title: "Comptes supprimés",
      value: stats.supprimes,
      icon: UserX,
      color: "red",
    },
    {
      title: "Comptes actifs",
      value: stats.actifs,
      icon: UserCheck,
      color: "green",
    },
    {
      title: "Comptes en attente",
      value: stats.enAttente,
      icon: Clock,
      color: "yellow",
    },
  ];

  const autres = Math.max(
    0,
    stats.total -
      stats.actifs -
      stats.enAttente -
      stats.supprimes
  );

  const chartData = [
    {
      name: "Comptes actifs",
      value: stats.actifs,
      color: "#16a34a",
    },
    {
      name: "Comptes en attente",
      value: stats.enAttente,
      color: "#eab308",
    },
    {
      name: "Comptes supprimés",
      value: stats.supprimes,
      color: "#dc2626",
    },
    ...(autres > 0
      ? [
          {
            name: "Autres statuts",
            value: autres,
            color: "#94a3b8",
          },
        ]
      : []),
  ];

  const pieData =
    stats.total > 0
      ? chartData.filter((item) => item.value > 0)
      : [
          {
            name: "Aucun utilisateur",
            value: 1,
            color: "#e5e7eb",
          },
        ];

  const percentage = (value: number) =>
    stats.total > 0
      ? ((value / stats.total) * 100).toFixed(1)
      : "0";

  return (
    <div className="admin-dashboard">
      <div className="admin-page-heading">
        <h1>Tableau de bord</h1>
        <p>
          Vue d'ensemble de la messagerie interne
        </p>
      </div>

      {loading && (
        <div className="admin-message">
          Chargement des statistiques...
        </div>
      )}

      {error && (
        <div className="admin-error">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="admin-stats-grid">
            {cards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  className="admin-stat-card"
                  key={card.title}
                >
                  <div className="admin-stat-top">
                    <div
                      className={`admin-stat-icon ${card.color}`}
                    >
                      <Icon size={27} />
                    </div>

                    <strong className="admin-stat-value">
                      {card.value}
                    </strong>
                  </div>

                  <p>{card.title}</p>
                </div>
              );
            })}
          </div>

          <div className="admin-chart-card">
            <div className="admin-chart-heading">
              <h2>Répartition des comptes</h2>
              <p>
                Statistiques selon le statut des utilisateurs
              </p>
            </div>

            <div className="admin-chart-content">
              <div className="admin-donut">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="65%"
                      outerRadius="90%"
                      startAngle={90}
                      endAngle={-270}
                      stroke="none"
                      paddingAngle={
                        pieData.length > 1 ? 3 : 0
                      }
                    >
                      {pieData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.color}
                        />
                      ))}
                    </Pie>

                    {stats.total > 0 && <Tooltip />}
                  </PieChart>
                </ResponsiveContainer>

                <div className="admin-donut-center">
                  <strong>{stats.total}</strong>
                  <span>Utilisateurs</span>
                </div>
              </div>

              <div className="admin-chart-legend">
                {chartData.map((item) => (
                  <div
                    className="admin-legend-item"
                    key={item.name}
                  >
                    <span
                      className="admin-legend-dot"
                      style={{
                        backgroundColor: item.color,
                      }}
                    />

                    <div className="admin-legend-info">
                      <span>{item.name}</span>
                      <small>
                        {item.value} compte(s)
                      </small>
                    </div>

                    <strong>
                      {percentage(item.value)} %
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
