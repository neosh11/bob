import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../features/auth/useAuth";

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.initialized || auth.loading) {
    return <div className="page-state">Checking authentication...</div>;
  }

  if (!auth.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
