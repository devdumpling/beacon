import { fail, redirect } from "@sveltejs/kit";
import { verify } from "@node-rs/argon2";
import { lucia } from "$lib/server/auth";
import { sql } from "$lib/db";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) {
    redirect(302, "/");
  }
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const formData = await request.formData();
    const email = formData.get("email");
    const password = formData.get("password");

    if (typeof email !== "string" || typeof password !== "string") {
      return fail(400, { error: "Invalid input" });
    }

    const [user] = await sql`
      SELECT id, email, password_hash FROM dashboard_users WHERE email = ${email}
    `;

    if (!user) {
      return fail(400, { error: "Invalid email or password" });
    }

    const validPassword = await verify(user.password_hash, password);
    if (!validPassword) {
      return fail(400, { error: "Invalid email or password" });
    }

    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies.set(sessionCookie.name, sessionCookie.value, {
      path: ".",
      ...sessionCookie.attributes,
    });

    redirect(302, "/");
  },
};
