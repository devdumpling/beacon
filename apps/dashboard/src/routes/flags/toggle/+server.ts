import { json } from "@sveltejs/kit";
import { toggleFlag } from "$lib/db";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const { flagId, enabled } = await request.json();
  const flag = await toggleFlag(flagId, enabled);

  // TODO: Notify Gleam API to broadcast flag update to connected clients
  // await fetch(`${GLEAM_API_URL}/api/flags/broadcast`, { ... })

  return json({ success: true, flag });
};
