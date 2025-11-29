import { sql, getFlags } from "$lib/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const [project] = await sql`SELECT id FROM projects LIMIT 1`;
  const projectId = project?.id;

  if (!projectId) {
    return { flags: [] };
  }

  const flags = await getFlags(projectId);
  return { flags };
};
