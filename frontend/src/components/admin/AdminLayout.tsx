import { useState } from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";
import "../../styles/admin.css";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth > 768
  );

  return (
    <div
      className={`admin-layout ${
        !sidebarOpen ? "sidebar-closed" : ""
      }`}
    >
      {sidebarOpen && <AdminSidebar />}

      {sidebarOpen && (
        <div
          className="admin-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="admin-main">
        <AdminHeader
          onToggleSidebar={() =>
            setSidebarOpen((previous) => !previous)
          }
        />

        <main className="admin-content">
          <Outlet />
        </main>

        <footer className="admin-footer">
          © {new Date().getFullYear()} — École Nationale
          d'Informatique de Fianarantsoa.
          Tous droits réservés.
        </footer>
      </div>
    </div>
  );
}
