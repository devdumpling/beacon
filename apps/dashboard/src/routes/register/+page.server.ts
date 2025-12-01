import { fail, redirect } from "@sveltejs/kit";
import { hash } from "@node-rs/argon2";
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

    if (password.length < 8) {
      return fail(400, { error: "Password must be at least 8 characters" });
    }

    // Check if email already exists
    const [existing] = await sql`
      SELECT id FROM dashboard_users WHERE email = ${email}
    `;

    if (existing) {
      return fail(400, { error: "Email already registered" });
    }

    // Hash password and create user
    const passwordHash = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    const [user] = await sql`
      INSERT INTO dashboard_users (email, password_hash)
      VALUES (${email}, ${passwordHash})
      RETURNING id
    `;

    // Create session
    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies.set(sessionCookie.name, sessionCookie.value, {
      path: ".",
      ...sessionCookie.attributes,
    });

    redirect(302, "/");
  },
};
