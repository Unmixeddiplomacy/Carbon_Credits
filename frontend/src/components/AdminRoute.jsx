import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute() {
  const { user, isHydrated } = useAuth();
  const location = useLocation();

  if (!isHydrated) return null;

  if (!user || user.role !== "admin") {
    return <Navigate to="/dashboard" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
