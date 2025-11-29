import { json } from "@sveltejs/kit";
import { sql, createFlag } from "$lib/db";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const { key, name } = await request.json();

  const [project] = await sql`SELECT id FROM projects LIMIT 1`;
  if (!project) {
    return json({ error: "No project found" }, { status: 400 });
  }

  const flag = await createFlag(project.id, key, name);
  return json({ success: true, flag });
};
