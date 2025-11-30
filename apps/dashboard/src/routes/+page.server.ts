import { sql, getRecentEvents, getFlags } from "$lib/db";
import type { PageServerLoad } from "./$types";

// For prototype, hardcode the first project
const PROJECT_ID = "00000000-0000-0000-0000-000000000000";

export const load: PageServerLoad = async () => {
  // Get first project or use placeholder (ORDER BY id for deterministic results)
  const [project] = await sql`SELECT id FROM projects ORDER BY id LIMIT 1`;
  const projectId = project?.id ?? PROJECT_ID;
  console.log("[dashboard] Loading data for project:", projectId);

  const [eventCountResult] = await sql`
    SELECT count(*)::int as count 
    FROM events 
    WHERE project_id = ${projectId}
      AND timestamp > NOW() - INTERVAL '7 days'
  `;

  const [sessionCountResult] = await sql`
    SELECT count(*)::int as count 
    FROM sessions 
    WHERE project_id = ${projectId}
      AND started_at > NOW() - INTERVAL '7 days'
  `;

  const flags = await getFlags(projectId);
  const recentEvents = await getRecentEvents(projectId, 10);

  console.log("[dashboard] Results:", {
    eventCount: eventCountResult?.count,
    sessionCount: sessionCountResult?.count,
    flagCount: flags.length,
    recentEventsCount: recentEvents.length,
  });

  return {
    eventCount: eventCountResult?.count ?? 0,
    sessionCount: sessionCountResult?.count ?? 0,
    flagCount: flags.filter((f: { enabled: boolean }) => f.enabled).length,
    recentEvents,
  };
};
