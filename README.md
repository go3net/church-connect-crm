# Church Connect CRM

**Live demo:** https://church-connect-crm-app-production.up.railway.app

Multi-tenant SaaS for church membership, visitor follow-up, cell groups, and multi-channel (WhatsApp/SMS/email) engagement automation. Nigeria-first, built to scale across Africa.

**Stack:** Next.js 14 · Prisma 5 · PostgreSQL · NextAuth (RBAC) · WhatsApp Cloud API · Termii/Twilio SMS · Resend · Anthropic Claude · Upstash · Cloudinary · Paystack · Sentry · Railway.

## Status — feature complete

Full system design: **[CHURCH_CONNECT_CRM_DESIGN.md](CHURCH_CONNECT_CRM_DESIGN.md)** (sources in [`docs/`](docs/)). Anyone can **sign up** at the live URL and get a fully-provisioned church.

**Features (all live):**
- **Auth & tenancy** — church self-signup, NextAuth + JWT, 4-role RBAC, tenant-scoped API guard, audit trail, rate-limited public routes.
- **First timers** — capture → auto Day 0–30 follow-up journey → convert to member; detail page.
- **Members** — list, rich detail (attendance/follow-ups/prayer/engagement), edit, status.
- **Cell groups** — CRUD, leader + member assignment.
- **Services & attendance** — manual marking + public QR self check-in; 2nd-visit auto-promotion.
- **Follow-ups** — worklist with outcomes (cell leaders see only their own) + **AI suggestions** (Claude, with rule-based fallback).
- **Prayer requests** — capture + status workflow.
- **Broadcasts** — segmented WhatsApp/SMS/email, queued dispatch + delivery tallies.
- **Automation** — low-code workflow/step/template builder.
- **Reports** — 5 reports with preview + CSV export.
- **Billing** — Paystack subscriptions, usage limits, webhook.
- **Staff & settings** — staff/role management, church profile + per-church messaging credentials.
- **Messaging** — WhatsApp/SMS/email dispatcher, queue, delivery webhook (delivered/read/replied), dev-safe log mode.
- **Ops** — `/api/health` (Railway healthcheck), Dockerfile build, push-to-deploy.

**Cron jobs (7, live on Railway):** `automation-advance`, `birthdays`, `anniversaries`, `engagement-recalc`, `follow-up-reminders`, `inactivity-sweep`, `broadcast-dispatch`.

## Run locally

```bash
cp .env.example .env        # DATABASE_URL + NEXTAUTH_SECRET (openssl rand -base64 32)
npm install
npm run db:push
npm run db:seed             # demo church + users
npm run dev                 # http://localhost:3000
```

Demo login: **admin@gracechapel.org** / **password123**. Or **sign up** a new church at `/signup`.

Messages log to console until `MESSAGING_LIVE="true"` + provider keys are set. Cron routes are POST-only, gated by the `x-cron-secret` header.

## Roles

`SUPER_ADMIN` · `PASTOR` · `CHURCH_ADMIN` · `CELL_LEADER`

## Going fully live (set in Railway)
- Messaging: `MESSAGING_LIVE=true` + `WHATSAPP_*`, `TERMII_API_KEY`, `RESEND_API_KEY`
- WhatsApp delivery: webhook → `/api/webhooks/whatsapp` (uses `WHATSAPP_VERIFY_TOKEN`)
- Billing: `PAYSTACK_SECRET_KEY` + webhook → `/api/billing/webhook`
- AI: `ANTHROPIC_API_KEY` (optional; rule-based fallback otherwise)
