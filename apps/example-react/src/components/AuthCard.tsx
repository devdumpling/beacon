import { useState, type FormEvent } from "react";

interface AuthCardProps {
  currentUser: string | null;
  onLogin: (username: string) => void;
  onLogout: () => void;
}

export default function AuthCard({
  currentUser,
  onLogin,
  onLogout,
}: AuthCardProps) {
  const [username, setUsername] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed) {
      onLogin(trimmed);
      setUsername("");
    }
  };

  if (currentUser) {
    return (
      <section className="card">
        <h2>Welcome back!</h2>
        <p className="card-description">
          Signed in as <strong>{currentUser}</strong>. All events now include
          your user ID.
        </p>
        <button className="btn-secondary" onClick={onLogout}>
          Sign Out
        </button>
        <div className="code-hint">
          <code>track("user_signed_out")</code>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Sign In</h2>
      <p className="card-description">
        Events are tracked anonymously. Sign in to link activity to your
        account.
      </p>
      <form className="login-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="e.g., jane@example.com"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <button type="submit">Sign In</button>
      </form>
      <div className="code-hint">
        <code>
          identify(userId, {"{"} traits {"}"})
        </code>
      </div>
    </section>
  );
}
