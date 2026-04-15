import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import Navbar from "../../components/Navbar.jsx";
import AppHydrator from "./AppHydrator.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const baseNavItems = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "My Trees", to: "/my-trees" },
  { label: "Credits", to: "/credits" },
  { label: "Marketplace", to: "/marketplace" },
  { label: "Transactions", to: "/transactions" },
  { label: "Verification", to: "/verification" },
  { label: "Support", to: "/app/support" },
];

function SidebarContent({ onNavigate, navItems }) {
  return (
    <nav className="flex-1 space-y-1.5 px-4 pt-6">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            [
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              "hover:bg-emerald-50 hover:text-emerald-700 hover:scale-[1.01]",
              isActive
                ? "bg-emerald-500 text-white shadow-md"
                : "text-neutral-600",
            ].join(" ")
          }
        >
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function SidebarLayout() {
  const { isAuthenticated, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems =
    user?.role === "admin"
      ? [{ label: "Admin", to: "/admin" }]
      : baseNavItems;

  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900">
      <AppHydrator />
      <Navbar />

      <div className="flex flex-1">
        {isAuthenticated && (
          <>
            {/* Desktop sidebar */}
            <aside className="hidden w-64 shrink-0 border-r border-neutral-200 bg-neutral-50 md:block">
              <div className="h-full flex flex-col">
                <SidebarContent navItems={navItems} />
              </div>
            </aside>

            {/* Mobile toggle button */}
            <button
              type="button"
              aria-label="Open sidebar"
              className="md:hidden fixed top-20 left-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-700 shadow-sm"
              onClick={() => setMobileOpen(true)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path
                  fillRule="evenodd"
                  d="M3.75 6.75a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm0 5.25a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75zm.75 4.5a.75.75 0 000 1.5h15a.75.75 0 000-1.5h-15z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Mobile drawer */}
            {mobileOpen && (
              <div className="md:hidden">
                <div
                  className="fixed inset-0 z-40 bg-black/30"
                  onClick={() => setMobileOpen(false)}
                />
                <div className="fixed inset-y-0 left-0 z-50 w-64 border-r border-neutral-200 bg-white shadow-lg">
                  <div className="flex h-16 items-center justify-between px-4 border-b border-neutral-200">
                    <span className="text-sm font-semibold tracking-wide">Menu</span>
                    <button
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 text-neutral-700"
                      onClick={() => setMobileOpen(false)}
                      aria-label="Close sidebar"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-5 w-5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                  <SidebarContent
                    navItems={navItems}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </div>
              </div>
            )}
          </>
        )}

        <main className="flex-1">
          <div className="px-4 py-6 md:px-8">
            {/* Nested protected pages render here */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
