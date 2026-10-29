import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/admin/login(.*)",
  "/api/dev(.*)",
  "/api/cron(.*)",
  "/",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  // Redirect unauthenticated HTML requests to /admin/* directly to /admin/login
  if (isAdminRoute(request) && !request.nextUrl.pathname.startsWith("/admin/login")) {
    const authData = await auth();
    if (!authData.userId) {
      if (!request.nextUrl.pathname.startsWith("/api/")) {
        const loginUrl = new URL("/admin/login", request.url);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  if (!isPublicRoute(request)) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      const authData = await auth();
      if (!authData.userId) {
        return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
      }
    } else {
      await auth.protect();
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
