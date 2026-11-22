import { NavLink, useNavigate } from "react-router-dom";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  UserPlus,
  LogOut,
} from "lucide-react";

export default function AdminSidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("utilisateur");
    navigate("/", { replace: true });
  };

  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <div className="admin-brand-icon">
          <GraduationCap size={34} />
        </div>

        <div>
          <h2>ENI</h2>
          <span>Fianarantsoa</span>
        </div>
      </div>

      <div className="admin-sidebar-divider" />

      <div className="admin-menu-label">
        ADMINISTRATION
      </div>

      <nav className="admin-navigation">
        <NavLink to="/admin/dashboard">
          <LayoutDashboard size={21} />
          <span>Tableau de bord</span>
        </NavLink>

        <NavLink to="/admin/utilisateurs">
          <Users size={21} />
          <span>Gestion des utilisateurs</span>
        </NavLink>

        <NavLink to="/admin/inscriptions">
          <UserPlus size={21} />
          <span>Gestion des inscriptions</span>
        </NavLink>
      </nav>

      <div className="admin-sidebar-bottom">
        <button
          className="admin-logout"
          onClick={handleLogout}
        >
          <LogOut size={21} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
