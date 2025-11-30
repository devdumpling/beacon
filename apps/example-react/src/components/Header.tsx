import type { ConnectionState } from "@beacon/sdk";

interface HeaderProps {
  connectionState: ConnectionState;
  currentUser: string | null;
}

export default function Header({ connectionState, currentUser }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-brand">
        <h1>Beacon SDK</h1>
        <span className="header-subtitle">React Example</span>
      </div>
      <div className="header-status">
        <div className="user-badge">
          <span className="user-label">Tracking as</span>
          <span className={`user-value ${currentUser ? "identified" : ""}`}>
            {currentUser || "Anonymous"}
          </span>
        </div>
        <div className="connection-badge">
          <span className={`status-dot status-${connectionState}`} />
          <span className="status-text">
            {connectionState.charAt(0).toUpperCase() + connectionState.slice(1)}
          </span>
        </div>
      </div>
    </header>
  );
}
