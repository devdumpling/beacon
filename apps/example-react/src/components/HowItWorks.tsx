export default function HowItWorks() {
  return (
    <details className="card how-it-works">
      <summary>How Identity Tracking Works</summary>
      <div className="details-content">
        <dl className="id-list">
          <dt>
            <code>anon_id</code>
          </dt>
          <dd>Generated on init. Persists until page refresh.</dd>

          <dt>
            <code>session_id</code>
          </dt>
          <dd>Rotates after 30min inactivity.</dd>

          <dt>
            <code>user_id</code>
          </dt>
          <dd>
            Set via <code>identify()</code>. Links anonymous activity.
          </dd>
        </dl>
        <div className="flow-diagram">
          <span className="flow-step">Anonymous</span>
          <span className="flow-arrow">→</span>
          <span className="flow-step highlight">identify()</span>
          <span className="flow-arrow">→</span>
          <span className="flow-step">Identified</span>
        </div>
      </div>
    </details>
  );
}
