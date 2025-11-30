import {
  type LogEntry,
  LOG_ICONS,
  syntaxHighlight,
} from "@beacon/example-shared";

interface EventLogProps {
  logs: LogEntry[];
  onClear: () => void;
}

function LogEntryItem({ entry }: { entry: LogEntry }) {
  const time = entry.timestamp.toLocaleTimeString();
  const icon = LOG_ICONS[entry.type];
  const hasPayload = entry.payload !== undefined;

  if (hasPayload) {
    return (
      <details className={`log-entry type-${entry.type} expandable`}>
        <summary>
          <span className="log-time">{time}</span>
          <span className="log-icon">{icon}</span>
          <span
            className="log-message"
            dangerouslySetInnerHTML={{ __html: entry.message }}
          />
          {entry.direction !== "system" && (
            <span className={`log-badge ${entry.direction}`}>
              {entry.direction}
            </span>
          )}
        </summary>
        <div className="log-payload">
          <pre
            dangerouslySetInnerHTML={{
              __html: syntaxHighlight(entry.payload),
            }}
          />
        </div>
      </details>
    );
  }

  return (
    <div className={`log-entry type-${entry.type}`}>
      <span className="log-time">{time}</span>
      <span className="log-icon">{icon}</span>
      <span
        className="log-message"
        dangerouslySetInnerHTML={{ __html: entry.message }}
      />
    </div>
  );
}

export default function EventLog({ logs, onClear }: EventLogProps) {
  return (
    <>
      <div className="log-header">
        <h2>Event Log</h2>
        <button className="btn-ghost" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="log-container">
        {logs.length === 0 ? (
          <div className="log-empty">
            Events will appear here as they're sent...
          </div>
        ) : (
          logs.map((entry) => <LogEntryItem key={entry.id} entry={entry} />)
        )}
      </div>
    </>
  );
}
