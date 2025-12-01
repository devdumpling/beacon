import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const publicPaths = ["/login", "/register"];
  const isPublicPath = publicPaths.some((path) =>
    url.pathname.startsWith(path),
  );

  if (!locals.user && !isPublicPath) {
    redirect(302, "/login");
  }

  return {
    user: locals.user,
  };
};
