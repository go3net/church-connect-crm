# Church Connect CRM — System Design Document

**A multi-tenant SaaS platform for church membership, visitor follow-up, and member engagement across Africa.**

| | |
|---|---|
| **Document** | System Design & Architecture (v1.0) |
| **Date** | 7 June 2026 |
| **Status** | Design — pre-build |
| **Stack** | Next.js 14 · Prisma 5 · PostgreSQL · WhatsApp Cloud API · SMS · Resend · Anthropic · Paystack · Railway |

---

## Executive Summary

Church Connect CRM is a mobile-first, cloud-based platform that automates the full lifecycle of church engagement: capturing first-time visitors, running an automated multi-channel follow-up journey (WhatsApp + SMS + email), converting visitors to members, organising members into cell groups, tracking attendance, scoring engagement, and surfacing it all in role-aware dashboards and reports.

It is built as a **single Next.js 14 application** backed by **PostgreSQL via Prisma**, deliberately mirroring a proven production stack so messaging, cron, billing, and auth patterns are reused rather than rebuilt. The system is **multi-tenant from the schema up** — every record is scoped to a `Church` (tenant) and `Branch` — so it serves one local congregation and scales to thousands of churches on shared infrastructure.

**Four roles** govern access: `SUPER_ADMIN` (platform), `PASTOR` (church-wide), `CHURCH_ADMIN` (registration & comms), and `CELL_LEADER` (assigned members only).

**Monetization** is a SaaS subscription + messaging-credit hybrid billed through Paystack, with tiered plans (Free → Pro) sized to the African church market and justified against per-message unit economics.

---

## Deliverables / Table of Contents

1. System Architecture
2. Database Schema *(Prisma)*
3. ER Diagram
4. API Endpoints
5. User Flow Diagrams
6. UI/UX Wireframes
7. Development Roadmap
8. MVP Features
9. Scalability Plan
10. Full Source Code Structure
11. Deployment Guide
12. Cost Estimate
13. Monetization Strategy (SaaS Model)

> Sections 2 & 3 are presented together (schema + ERD), as are 5 & 6 (flows + wireframes) and 7 & 8 (roadmap + MVP).

---
