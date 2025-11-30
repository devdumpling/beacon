interface FlagsCardProps {
  flags: Record<string, boolean>;
}

export default function FlagsCard({ flags }: FlagsCardProps) {
  const flagEntries = Object.entries(flags);

  return (
    <section className="card">
      <h2>Feature Flags</h2>
      <div>
        {flagEntries.length === 0 ? (
          <p className="placeholder">No flags received yet</p>
        ) : (
          flagEntries.map(([key, value]) => (
            <div key={key} className="flag-item">
              <span className="flag-name">{key}</span>
              <span className={`flag-value ${value ? "enabled" : "disabled"}`}>
                {String(value)}
              </span>
            </div>
          ))
        )}
      </div>
      <div className="code-hint">
        <code>flag("feature_name")</code>
      </div>
    </section>
  );
}
