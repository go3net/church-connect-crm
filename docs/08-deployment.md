# 11. Deployment Guide

This section describes how to deploy Church Connect CRM to production. **Railway is the primary, supported target** — a single Next.js 14 service, a managed PostgreSQL database, and Upstash Redis, with cron driven by Railway scheduled jobs. Shorter notes cover **Vercel** and **DigitalOcean** as alternatives.

The application is a single Next.js 14 (App Router) deployable: it serves the dashboard UI, the NextAuth session layer, all `/api/*` route handlers (including webhooks and `/api/cron/*`), and the Prisma data layer from one process. There is no separate worker tier — background work runs through Upstash-backed queues drained by frequent cron ticks.

---

## 11.1 Provisioning on Railway

### 11.1.1 Create the project and Next.js service

1. Sign in at [railway.app](https://railway.app) and create a **New Project**.
2. Choose **Deploy from GitHub repo** and select the `church-connect-crm` repository. Railway auto-detects Next.js and provisions a Nixpacks build.
3. In the service **Settings → Build**, confirm:
   - **Build command:** `npm run build` (which runs `prisma generate && next build`).
   - **Start command:** `npm run start` (`next start -p $PORT`).
   - **Watch paths:** leave default so every push to `main` triggers a deploy.
4. Set the **Root Directory** if the app is not at repo root (it is at root for this project, so leave blank).

> Railway injects `$PORT` at runtime. Do **not** hard-code a port; `next start -p $PORT` binds correctly.

### 11.1.2 Add the PostgreSQL plugin

1. In the project canvas, click **New → Database → Add PostgreSQL**.
2. Railway creates a managed Postgres instance and exposes connection variables on the plugin (`PGHOST`, `PGPORT`, `DATABASE_URL`, etc.).
3. Reference these from the Next.js service using Railway's variable references so they stay in sync:
   - `DATABASE_URL` → `${{Postgres.DATABASE_URL}}`
   - `DIRECT_URL` → `${{Postgres.DATABASE_URL}}` (Railway Postgres does not pool by default; if you later front it with PgBouncer, point `DATABASE_URL` at the pooler and keep `DIRECT_URL` on the direct 5432 connection for migrations).

### 11.1.3 Add Redis (Upstash)

Use **Upstash Redis** for rate-limiting and the background queues (message retry, broadcast dispatch).

1. Create an Upstash Redis database at [upstash.com](https://upstash.com) (choose a region close to the Railway region, e.g. EU or US to match your Railway deploy region).
2. Copy the **REST URL** and **REST token** from the Upstash console.
3. Add them to the Railway service as `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

> The app uses the Upstash **REST** client (`@upstash/redis` / `@upstash/ratelimit`), not a raw TCP Redis connection — this is serverless-friendly and works identically on Railway, Vercel, and DigitalOcean. You may alternatively add Railway's own Redis plugin, but the canonical setup is Upstash REST.

---

## 11.2 Environment Variables

Set all of the following in **Railway → Service → Variables** (and mirror them to any preview/staging environment). Every value should be treated as a secret unless noted as public.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Primary Postgres connection string used by Prisma Client at runtime (pooled if a pooler is configured). |
| `DIRECT_URL` | Direct, unpooled Postgres connection used by `prisma migrate` for DDL. |
| `NEXTAUTH_URL` | Canonical public base URL of the app (e.g. `https://app.churchconnect.ng`); used by NextAuth for callbacks. |
| `NEXTAUTH_SECRET` | Secret for signing/encrypting NextAuth JWTs and session tokens. |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp Cloud API phone-number ID used as the send-from identity. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business Account (WABA) ID, used for template management. |
| `WHATSAPP_ACCESS_TOKEN` | Permanent system-user access token for calling the WhatsApp Cloud API. |
| `WHATSAPP_VERIFY_TOKEN` | Shared secret echoed back during webhook verification (`hub.verify_token`). |
| `TERMII_API_KEY` | API key for Termii, the primary SMS provider. |
| `TERMII_SENDER_ID` | Approved Termii alphanumeric sender ID for outbound SMS. |
| `TWILIO_ACCOUNT_SID` | Twilio account SID for the SMS fallback path. |
| `TWILIO_AUTH_TOKEN` | Twilio auth token paired with the SID. |
| `TWILIO_FROM` | Twilio sending number (E.164) used when falling back from Termii. |
| `RESEND_API_KEY` | API key for Resend transactional email. |
| `EMAIL_FROM` | Verified from-address/display name for outbound email (e.g. `Church Connect <no-reply@churchconnect.ng>`). |
| `ANTHROPIC_API_KEY` | API key for Anthropic Claude, used by the AI follow-up engine. |
| `CRON_SECRET` | Shared secret required in the header of every `/api/cron/*` request to authorize scheduled jobs. |
| `PAYSTACK_SECRET_KEY` | Paystack secret key for creating/verifying SaaS subscription charges and validating webhooks. |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key (safe to expose client-side) for the billing checkout widget. |
| `CLOUDINARY_URL` | Cloudinary credential URL (`cloudinary://<api_key>:<api_secret>@<cloud_name>`) for member photo uploads. |
| `SENTRY_DSN` | Sentry Data Source Name for error and performance telemetry. |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint for rate-limiting and queues. |
| `UPSTASH_REDIS_REST_TOKEN` | Bearer token for the Upstash Redis REST endpoint. |

> **Cloudinary alternative:** instead of the single `CLOUDINARY_URL`, you may set the three discrete variables `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Use one form or the other consistently.

### Generating secrets

```bash
# NEXTAUTH_SECRET and CRON_SECRET — strong random values
openssl rand -base64 32   # NEXTAUTH_SECRET
openssl rand -hex 32      # CRON_SECRET (also fine for NEXTAUTH_SECRET)
```

`WHATSAPP_VERIFY_TOKEN` can be any opaque string you choose — it just has to match what you enter in the Meta webhook configuration.

---

## 11.3 Database: Prisma Migrate & Seed

Prisma migrations run against `DIRECT_URL` (unpooled). The recommended pattern is to run `migrate deploy` as a **release/deploy step** so the schema is current before the new revision starts serving traffic.

### 11.3.1 Apply migrations

Add a deploy command in Railway (**Settings → Deploy → Custom Start/Pre-deploy**), or run manually via the Railway CLI:

```bash
# Apply all committed migrations (idempotent, safe to re-run)
npx prisma migrate deploy
```

Recommended Railway configuration — keep migration separate from boot so a failed migration fails the deploy:

- **Pre-deploy command:** `npx prisma migrate deploy`
- **Start command:** `npm run start`

To run it manually against the production database from your machine:

```bash
railway link            # select the project/environment
railway run npx prisma migrate deploy
```

### 11.3.2 Seed Plan tiers

`prisma/seed.ts` loads the SaaS **Plan** tiers (e.g. Starter / Growth / Scale) and any baseline reference data. Run it **once** after the first successful migration:

```bash
railway run npx prisma db seed
```

This invokes the seed configured in `package.json`:

```jsonc
// package.json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

> The seed is written to be **idempotent** (upserts on Plan by a stable key), so re-running it after a redeploy will not duplicate plans. Do not bundle the seed into the per-deploy release step — run it deliberately.

### 11.3.3 First SUPER_ADMIN

After seeding, create the initial `SUPER_ADMIN` user. If the seed does not provision one for your environment, use the admin bootstrap script:

```bash
railway run npx ts-node scripts/create-super-admin.ts -- \
  --email you@churchconnect.ng --name "Platform Owner"
```

The new admin signs in via NextAuth credentials and from there can create the first Church tenant, its Branches, and invite PASTOR / CHURCH_ADMIN / CELL_LEADER users.

---

## 11.4 Cron Jobs on Railway

Background and scheduled work is driven by **Railway scheduled jobs** (cron) that issue authenticated HTTP requests to the app's `/api/cron/*` routes. Each route verifies the request by checking the `CRON_SECRET` carried in a request header.

### 11.4.1 How a cron service calls a route

Each cron entry is a tiny scheduled service that runs a single `curl`. The job must send the `CRON_SECRET` header and target the canonical public URL:

```bash
curl -fsS -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  "$NEXTAUTH_URL/api/cron/automation-advance"
```

On Railway you can implement these either as **Cron Schedules on a job service** (recommended) or via an external scheduler. For the job-service approach, set the service's **Cron Schedule** field to the cron expression and its start command to the `curl` above (parameterising the route per service). `CRON_SECRET` and `NEXTAUTH_URL` are referenced from the shared environment.

> **Route auth contract:** every handler under `/api/cron/*` rejects with `401` unless the incoming `x-cron-secret` header equals `CRON_SECRET`. The same secret is used by all routes. Keep these routes out of the public sitemap and rate-limit them defensively.

### 11.4.2 Canonical schedule

All times are UTC. Adjust the daily run times to land in the early morning of the dominant timezone for your tenants (Nigeria is **WAT, UTC+1**, so `0 4 * * *` UTC ≈ 5:00 AM WAT). The table below maps each canonical route to a recommended cron expression.

| Cron route (`/api/cron/...`) | Cron expression | Cadence | Purpose |
| --- | --- | --- | --- |
| `automation-advance` | `0 4 * * *` | Daily, early AM | Advance members through automation/follow-up sequences to their next step. |
| `birthdays` | `5 4 * * *` | Daily, early AM | Detect today's member birthdays and enqueue greetings. |
| `anniversaries` | `10 4 * * *` | Daily, early AM | Detect membership/wedding anniversaries and enqueue greetings. |
| `follow-up-reminders` | `15 4 * * *` | Daily, early AM | Notify CELL_LEADER / CHURCH_ADMIN of due follow-up tasks. |
| `inactivity-sweep` | `30 4 * * *` | Daily, early AM | Flag members crossing inactivity thresholds and trigger re-engagement. |
| `engagement-recalc` | `0 2 * * *` | Nightly | Recompute per-member engagement scores from recent activity. |
| `message-retry` | `*/5 * * * *` | Every 5 minutes | Retry failed/queued WhatsApp/SMS/email sends with backoff. |
| `broadcast-dispatch` | `*/2 * * * *` | Every 2 minutes | Drain the broadcast queue, sending batched messages within rate limits. |
| `billing-rollover` | `45 3 * * *` | Daily | Roll subscription periods, settle Paystack renewals, downgrade lapsed tenants. |
| `db-maintenance` | `0 5 * * 0` | Weekly (Sun) | VACUUM/ANALYZE, prune soft-deleted rows, compact logs and old queue records. |

> The daily jobs are deliberately **staggered by 5 minutes** (`:00`, `:05`, `:10`, …) to avoid a thundering herd on the database and outbound providers. `engagement-recalc` runs earlier in the night (02:00) because downstream daily jobs read its scores.

### 11.4.3 Idempotency

Every cron handler is designed to be **idempotent and re-entrant**: jobs claim work via row locks / status transitions and tolerate duplicate ticks (e.g. an overlapping `message-retry`). This makes the schedule safe to run on at-least-once cron infrastructure.

---

## 11.5 WhatsApp Cloud API Setup

Outbound and inbound WhatsApp messaging uses the **Meta WhatsApp Cloud API**.

### 11.5.1 Create the Meta app and WABA

1. In [Meta for Developers](https://developers.facebook.com), create a **Business** app and add the **WhatsApp** product.
2. This creates (or links) a **WhatsApp Business Account (WABA)**. Copy the **WhatsApp Business Account ID** → `WHATSAPP_BUSINESS_ACCOUNT_ID`.
3. Add or register your business **phone number**. Copy its **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`. Complete name/display verification for the number.

### 11.5.2 Permanent access token

Test tokens expire in 24 hours; production requires a **permanent System User token**:

1. In **Meta Business Settings → Users → System Users**, create a system user with an **Admin** role.
2. **Assign assets:** grant the system user full control over the app and the WABA.
3. **Generate token** with scopes `whatsapp_business_messaging` and `whatsapp_business_management`. Select **Never** for expiry.
4. Store it as `WHATSAPP_ACCESS_TOKEN`.

### 11.5.3 Webhook configuration

1. In the Meta app → **WhatsApp → Configuration → Webhook**, set:
   - **Callback URL:** `https://<your-domain>/api/webhooks/whatsapp`
   - **Verify token:** the value you put in `WHATSAPP_VERIFY_TOKEN`.
2. Meta sends a `GET` with `hub.mode`, `hub.challenge`, and `hub.verify_token`. The route validates the token and echoes `hub.challenge` to complete verification.
3. **Subscribe** the WABA to the `messages` field (and `message_template_status_update` to receive template approval callbacks).

> The webhook deploy must be live and reachable over HTTPS **before** you click verify, so deploy the app and set `WHATSAPP_VERIFY_TOKEN` first.

### 11.5.4 Message templates

Sessions outside the 24-hour customer-service window require **approved templates**:

1. In **WhatsApp Manager → Message Templates**, submit the templates the app uses (greetings, birthday/anniversary, follow-up nudges, broadcast intros) in each required language.
2. Use named placeholders/variables that match what the send code supplies (e.g. `{{1}}` = member first name).
3. Wait for Meta approval (minutes to ~24 hours). Only **APPROVED** templates can be sent; the app reads template status via `message_template_status_update` and will not dispatch a non-approved template.

---

## 11.6 SMS Sender ID Registration

### 11.6.1 Termii (primary)

1. Create a Termii account and copy the API key → `TERMII_API_KEY`.
2. Register an **alphanumeric Sender ID** (e.g. `ChurchHub`) under **Sender IDs**. Provide the business justification and sample messages Termii requires.
3. For **DND (Do-Not-Disturb)** numbers on Nigerian networks, register the Sender ID through Termii's **DND-route / corporate** approval so transactional messages reach MTN/Airtel/Glo/9mobile subscribers who have DND active. Approval can take several business days.
4. Set the approved Sender ID → `TERMII_SENDER_ID`.

> Until the Sender ID is approved, sends may be rejected or routed through a generic shortcode. Plan the registration ahead of go-live.

### 11.6.2 Twilio (fallback)

1. Create a Twilio account; copy the **Account SID** → `TWILIO_ACCOUNT_SID` and **Auth Token** → `TWILIO_AUTH_TOKEN`.
2. Provision a Twilio phone number capable of SMS to your destination countries and set it (E.164) → `TWILIO_FROM`.
3. Note that Nigerian SMS via international carriers may face delivery/sender-ID constraints; Twilio is the **fallback** used only when Termii fails or is unconfigured.

---

## 11.7 Custom Domains & DNS

### 11.7.1 On Railway

1. In **Service → Settings → Networking → Custom Domain**, add your domain, e.g. `app.churchconnect.ng`.
2. Railway returns a target **CNAME**. In your DNS provider, create:

   | Type | Name | Value |
   | --- | --- | --- |
   | CNAME | `app` | `<your-service>.up.railway.app` (the value Railway shows) |

3. For an **apex/root** domain (`churchconnect.ng`), use your DNS provider's **ALIAS/ANAME flattening** to the Railway target, since apex records cannot be CNAMEs. Otherwise serve the app on a subdomain and redirect the apex.
4. Railway provisions a TLS certificate automatically once DNS resolves.
5. Update `NEXTAUTH_URL` to the **final HTTPS custom domain** and redeploy — NextAuth callbacks and the cron `curl` base URL must use it.

### 11.7.2 Provider records to also configure

- **Resend:** add the SPF, DKIM, and (optional) DMARC records Resend provides for your sending domain so `EMAIL_FROM` authenticates.
- **WhatsApp/Paystack:** no DNS needed, but ensure their **webhook URLs** use the final custom domain.

---

## 11.8 Go-Live Checklist

**Infrastructure**
- [ ] Railway project created; Next.js service, PostgreSQL plugin, and Upstash Redis all provisioned.
- [ ] All environment variables from §11.2 set in the production environment (no test/sandbox keys).
- [ ] `DATABASE_URL` / `DIRECT_URL` reference the production Postgres; pooler (if any) configured correctly.

**Database**
- [ ] `prisma migrate deploy` ran cleanly as a pre-deploy step.
- [ ] `prisma db seed` ran once; Plan tiers present.
- [ ] First `SUPER_ADMIN` created and able to log in.

**Cron**
- [ ] All 10 canonical `/api/cron/*` jobs created with the schedules in §11.4.2.
- [ ] Each job sends the `x-cron-secret` header and targets the custom-domain base URL.
- [ ] A manual `curl` to one route returns `200`; an unauthenticated call returns `401`.

**Messaging**
- [ ] WhatsApp permanent token works; webhook verified; `messages` + template-status subscribed.
- [ ] Required WhatsApp templates submitted and **APPROVED**.
- [ ] Termii Sender ID approved (incl. DND route); Twilio fallback number live.
- [ ] Resend domain verified (SPF/DKIM green); test email delivered from `EMAIL_FROM`.

**Billing & telemetry**
- [ ] Paystack live keys set; subscription webhook URL points at the custom domain and verifies signatures.
- [ ] Sentry receiving events (trigger a test error).
- [ ] Cloudinary upload of a member photo succeeds.

**App & domain**
- [ ] Custom domain resolves over HTTPS; TLS cert issued.
- [ ] `NEXTAUTH_URL` matches the custom domain; login/logout and tenant switching work.
- [ ] RBAC spot-check: SUPER_ADMIN / PASTOR / CHURCH_ADMIN / CELL_LEADER each see only permitted data, scoped by `churchId` / `branchId`.
- [ ] Rate-limiting active (Upstash reachable); a burst of requests is throttled.

---

## 11.9 Alternative Targets

### 11.9.1 Vercel

Vercel suits the Next.js front end well, with two key differences:

- **Database:** Vercel does not host Postgres durably for this workload's needs in the same way; use a managed Postgres (Neon, Supabase, or the same Railway Postgres) and set `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) accordingly. Neon's pooled + direct endpoints map cleanly onto these two variables.
- **Cron:** replace Railway scheduled jobs with **Vercel Cron** in `vercel.json`. Vercel Cron invokes a path on a schedule; protect each `/api/cron/*` route with the same `CRON_SECRET` check (Vercel can attach an `Authorization: Bearer` or you keep the `x-cron-secret` convention via a thin wrapper). Note Vercel Cron's **minimum granularity and plan limits** — sub-5-minute cadences for `broadcast-dispatch`/`message-retry` may require a Pro/Enterprise plan or an external scheduler (e.g. Upstash QStash or GitHub Actions) hitting the same routes.

```jsonc
// vercel.json (excerpt)
{
  "crons": [
    { "path": "/api/cron/automation-advance", "schedule": "0 4 * * *" },
    { "path": "/api/cron/message-retry",      "schedule": "*/5 * * * *" }
    // ...one entry per canonical route from §11.4.2
  ]
}
```

Set `migrate deploy` and `db seed` to run via the Vercel **build/ignored-build step** or manually from the CLI, since Vercel builds are ephemeral. Keep Upstash, WhatsApp, Termii, Resend, Paystack, Sentry, and Cloudinary identical to §11.2.

### 11.9.2 DigitalOcean

Two viable shapes:

- **App Platform:** deploy the repo as a Node service, attach a **DigitalOcean Managed PostgreSQL** database (set `DATABASE_URL` to the pooled connection, `DIRECT_URL` to the direct one), and use App Platform's **scheduled components (jobs)** to run the cron `curl`s on the schedules in §11.4.2. Add the build step `prisma generate && next build` and the run command `next start`.
- **Droplet + Docker:** run the app behind Nginx (TLS via Let's Encrypt), Managed Postgres for the database, Upstash Redis for queues, and **system cron** entries on the Droplet issuing the authenticated `curl`s. Example crontab line:

  ```cron
  */5 * * * * curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://app.churchconnect.ng/api/cron/message-retry
  ```

In all alternatives the environment-variable contract (§11.2), Prisma steps (§11.3), cron schedule (§11.4), and external-provider setup (§11.5–11.6) are unchanged — only the hosting and scheduler mechanics differ.
