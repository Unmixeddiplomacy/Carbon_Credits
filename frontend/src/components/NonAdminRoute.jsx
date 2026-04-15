import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NonAdminRoute() {
  const { user, isHydrated } = useAuth();
  const location = useLocation();

  if (!isHydrated) return null;

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
