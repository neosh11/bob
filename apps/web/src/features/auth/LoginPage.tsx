import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "../../lib/apiClient";

import { useAuth } from "./useAuth";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const nextPath = (location.state as { from?: string } | null)?.from ?? "/";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await auth.login({
        password,
        username: username.trim() || undefined
      });
      navigate(nextPath, { replace: true });
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to complete request.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="eyebrow">Bob</p>
        <h1>Shared Access Sign In</h1>
        <p className="auth-description">Enter the deployment password configured in `BOB_SHARED_PASSWORD`.</p>

        <form onSubmit={onSubmit} className="auth-form">
          <label>
            Display Name (optional)
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={pending}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              type="password"
              required
              minLength={10}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={pending}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" disabled={pending}>
            {pending ? "Working..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
