export { default } from "next-auth/middleware";

// Protect the authenticated app. API routes do their own per-route guard
// (requireCtx/requirePermission); cron routes use the CRON_SECRET.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/members/:path*",
    "/first-timers/:path*",
    "/cell-groups/:path*",
    "/services/:path*",
    "/follow-ups/:path*",
    "/broadcasts/:path*",
    "/automation/:path*",
    "/reports/:path*",
    "/billing/:path*",
  ],
};
