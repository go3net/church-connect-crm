# Church Connect CRM

Multi-tenant SaaS for church membership, visitor follow-up, cell groups, and multi-channel (WhatsApp/SMS/email) engagement automation. Nigeria-first, built to scale across Africa.

**Stack:** Next.js 14 · Prisma 5 · PostgreSQL · NextAuth (RBAC) · WhatsApp Cloud API · Termii/Twilio SMS · Resend · Anthropic Claude · Upstash · Cloudinary · Paystack · Sentry · Railway.

## Status

Design phase. The full system design lives in **[CHURCH_CONNECT_CRM_DESIGN.md](CHURCH_CONNECT_CRM_DESIGN.md)** — architecture, database schema + ERD, API surface, user flows & wireframes, roadmap/MVP, scalability, source structure, deployment, cost, and monetization.

Per-deliverable source sections are in [`docs/`](docs/).

## Roles

`SUPER_ADMIN` · `PASTOR` · `CHURCH_ADMIN` · `CELL_LEADER`

## Next step

Decide whether to scaffold the v1 MVP (Prisma schema → auth/RBAC → first-timer + member + follow-up modules → seed).
