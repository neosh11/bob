import { Navigate, createBrowserRouter } from "react-router-dom";

import { ProtectedRoute } from "../components/ProtectedRoute";
import { LoginPage } from "../features/auth/LoginPage";
import { SessionsPage } from "../features/sessions/SessionsPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <SessionsPage />
      },
      {
        path: "/sessions/:sessionId",
        element: <SessionsPage />
      }
    ]
  },
  {
    path: "*",
    element: <Navigate to="/" replace />
  }
]);
