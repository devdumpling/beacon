import { redirect } from "@sveltejs/kit";
import { lucia } from "$lib/server/auth";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  redirect(302, "/");
};

export const actions: Actions = {
  default: async ({ locals, cookies }) => {
    if (!locals.session) {
      redirect(302, "/login");
    }

    await lucia.invalidateSession(locals.session.id);
    const sessionCookie = lucia.createBlankSessionCookie();
    cookies.set(sessionCookie.name, sessionCookie.value, {
      path: ".",
      ...sessionCookie.attributes,
    });

    redirect(302, "/login");
  },
};
