import { Menu, Bell, ChevronDown } from "lucide-react";

interface AdminHeaderProps {
  onToggleSidebar: () => void;
}

export default function AdminHeader({
  onToggleSidebar,
}: AdminHeaderProps) {
  return (
    <header className="admin-header">
      <button
        className="admin-menu-toggle"
        onClick={onToggleSidebar}
        aria-label="Afficher ou masquer le menu"
      >
        <Menu size={25} />
      </button>

      <div className="admin-header-right">
        <div className="admin-notification">
          <Bell size={23} />
        </div>

        <div className="admin-header-divider" />

        <div className="admin-profile">
          <div className="admin-avatar">AD</div>

          <div className="admin-profile-info">
            <strong>Administrateur</strong>
            <span>ENI Fianarantsoa</span>
          </div>

          <ChevronDown size={16} />
        </div>
      </div>
    </header>
  );
}
