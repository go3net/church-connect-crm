# Church Connect CRM

**Live demo:** https://church-connect-crm-app-production.up.railway.app

Multi-tenant SaaS for church membership, visitor follow-up, cell groups, and multi-channel (WhatsApp/SMS/email) engagement automation. Nigeria-first, built to scale across Africa.

**Stack:** Next.js 14 · Prisma 5 · PostgreSQL · NextAuth (RBAC) · WhatsApp Cloud API · Termii/Twilio SMS · Resend · Anthropic Claude · Upstash · Cloudinary · Paystack · Sentry · Railway.

## Status

**v1 MVP scaffold — runnable.** The full system design lives in **[CHURCH_CONNECT_CRM_DESIGN.md](CHURCH_CONNECT_CRM_DESIGN.md)** (per-deliverable sources in [`docs/`](docs/)).

Implemented in this scaffold:
- NextAuth credentials login + JWT sessions, 4-role RBAC ([src/lib/rbac.ts](src/lib/rbac.ts)) and tenant-scoped API guard ([src/lib/tenant.ts](src/lib/tenant.ts)).
- Multi-tenant Prisma schema (tenant root = `Church`) — [prisma/schema.prisma](prisma/schema.prisma).
- **First-timer** capture → auto-enrol in the Day 0–30 follow-up journey → **convert to member** (non-destructive).
- **Members** list with engagement, **Follow-ups** worklist with outcome logging (cell leaders see only their own).
- Messaging layer (WhatsApp / SMS / email) with a dev-safe log mode, unified dispatcher + template rendering, and `CommunicationLog`.
- Automation engine + cron routes: `automation-advance`, `birthdays`, `engagement-recalc`.
- Admin dashboard with live stats; mobile-responsive throughout.

## Run locally

```bash
cp .env.example .env        # set DATABASE_URL + NEXTAUTH_SECRET (openssl rand -base64 32)
npm install
npm run db:push             # create tables (or db:migrate for migrations)
npm run db:seed             # demo church, users, templates, workflow
npm run dev                 # http://localhost:3000
```

Login: **admin@gracechapel.org** / **password123** (also `pastor@`, `ada@` cell leader).

Messages log to the console by default. Set `MESSAGING_LIVE="true"` + provider keys to actually send.
Cron routes are POST-only and require the `x-cron-secret` header to match `CRON_SECRET`.

## Roles

`SUPER_ADMIN` · `PASTOR` · `CHURCH_ADMIN` · `CELL_LEADER`

## Next steps (not yet built)

Attendance/QR check-in, cell-group CRUD UI, broadcast composer, reports/export, billing (Paystack), AI follow-up suggestions, low-code automation builder. See the roadmap in the design doc.

<!-- ci: auto-deploy test 102815 -->
