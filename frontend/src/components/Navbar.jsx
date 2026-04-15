import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef(null);

  const initials = (() => {
    if (user?.name) {
      const parts = user.name.split(" ").filter(Boolean);
      if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      return parts[0][0]?.toUpperCase() ?? "U";
    }
    if (user?.email) return user.email[0]?.toUpperCase() ?? "U";
    return "U";
  })();

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center border-b border-neutral-200 bg-white/80 backdrop-blur-md">
      {/* Left brand area */}
      <div className="flex w-64 shrink-0 items-center px-6">
        <Link to="/" className="group flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-lg leading-none">
            <span className="-mt-0.5">🌿</span>
          </span>
          <span className="text-xl font-semibold tracking-tight text-neutral-900 transition-colors group-hover:text-emerald-600">
            Carbon Market
          </span>
        </Link>
      </div>

      {/* Right actions */}
      <div className="relative flex flex-1 items-center justify-end gap-2 px-4 md:px-6">
        {isAuthenticated && user ? (
		  <div className="relative" ref={containerRef}>
            <UserMenu
              user={user}
              initials={initials}
              onLogout={handleLogout}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center rounded-md border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-600 shadow-sm transition hover:bg-emerald-500 hover:text-white"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;

function UserMenu({ user, initials, onLogout }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!open) return;
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keyup", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keyup", onKey);
    };
  }, [open]);

  const navigate = useNavigate();
  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={buttonRef}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold">
          {initials}
        </span>
        <span className="hidden text-sm font-medium sm:inline">
          {user.name ?? "User"}
        </span>
        <svg
          className={`h-4 w-4 text-neutral-500 transition-transform ${open ? "rotate-180" : "rotate-0"}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-semibold leading-none">
              {user.name ?? "User"}
            </p>
            {user?.email && (
              <p className="text-xs text-neutral-500">{user.email}</p>
            )}
          </div>
          <div className="h-px bg-neutral-200" />
          <button
            role="menuitem"
            onClick={() => {
              close();
              onLogout();
            }}
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Log out
          </button>
        </div>
      )}
    </>
  );
}
