import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Church Connect CRM…");

  // ── Plans (global catalog) ────────────────────────────────
  const plans = [
    { name: "Free", slug: "free", priceKobo: 0, maxBranches: 1, maxMembers: 100, maxStaff: 2, monthlyMessageQuota: 100,
      features: ["First-timer capture", "Manual follow-up", "1 branch"] },
    { name: "Starter", slug: "starter", priceKobo: 1_500_000, maxBranches: 1, maxMembers: 500, maxStaff: 5, monthlyMessageQuota: 2000,
      features: ["Automation engine", "WhatsApp + SMS", "Birthday automation"] },
    { name: "Growth", slug: "growth", priceKobo: 4_000_000, maxBranches: 3, maxMembers: 2000, maxStaff: 20, monthlyMessageQuota: 8000,
      features: ["Multi-branch", "Engagement scoring", "AI follow-up suggestions", "Reports"] },
    { name: "Pro", slug: "pro", priceKobo: 10_000_000, maxBranches: 25, maxMembers: 20000, maxStaff: 200, monthlyMessageQuota: 40000,
      features: ["Unlimited automation", "Priority support", "Custom templates", "API access"] },
  ];
  for (const p of plans) {
    await db.plan.upsert({
      where: { slug: p.slug },
      update: { ...p, features: p.features as any },
      create: { ...p, features: p.features as any },
    });
  }
  const growth = await db.plan.findUniqueOrThrow({ where: { slug: "growth" } });

  // ── Demo church ───────────────────────────────────────────
  const church = await db.church.upsert({
    where: { slug: "grace-chapel" },
    update: {},
    create: {
      name: "Grace Chapel",
      slug: "grace-chapel",
      email: "hello@gracechapel.org",
      phone: "+2348030000000",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
  });

  await db.subscription.upsert({
    where: { churchId: church.id },
    update: {},
    create: {
      churchId: church.id,
      planId: growth.id,
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
    },
  });

  const branch = await db.branch.upsert({
    where: { churchId_name: { churchId: church.id, name: "Main Campus" } },
    update: {},
    create: { churchId: church.id, name: "Main Campus", isMain: true, city: "Lagos" },
  });

  // ── Users ─────────────────────────────────────────────────
  const pwd = await bcrypt.hash("password123", 10);
  const users = [
    { name: "Platform Owner", email: "super@churchconnect.app", role: "SUPER_ADMIN" as const, churchId: null, branchId: null },
    { name: "Pastor James", email: "pastor@gracechapel.org", role: "PASTOR" as const, churchId: church.id, branchId: branch.id },
    { name: "Church Admin", email: "admin@gracechapel.org", role: "CHURCH_ADMIN" as const, churchId: church.id, branchId: branch.id },
    { name: "Cell Leader Ada", email: "ada@gracechapel.org", role: "CELL_LEADER" as const, churchId: church.id, branchId: branch.id },
  ];
  const userRecords: Record<string, string> = {};
  for (const u of users) {
    const rec = await db.user.upsert({
      where: { email: u.email },
      update: { role: u.role, churchId: u.churchId, branchId: u.branchId },
      create: { ...u, passwordHash: pwd },
    });
    userRecords[u.role] = rec.id;
  }

  // ── Cell group led by Ada ─────────────────────────────────
  await db.cellGroup.upsert({
    where: { churchId_name: { churchId: church.id, name: "Lekki Cell" } },
    update: {},
    create: {
      churchId: church.id,
      branchId: branch.id,
      leaderId: userRecords["CELL_LEADER"],
      name: "Lekki Cell",
      meetingDay: "Tuesday",
      meetingTime: "18:00",
      location: "Lekki Phase 1",
    },
  });

  // ── Message templates ─────────────────────────────────────
  const templates = [
    { name: "Welcome (WhatsApp)", channel: "WHATSAPP" as const, category: "welcome",
      body: "Hello {{firstName}}, thank you for worshipping with us today. We hope you were blessed. Kindly reply and tell us how today's service impacted you. We look forward to seeing you again." },
    { name: "Welcome (SMS)", channel: "SMS" as const, category: "welcome",
      body: "Hello {{firstName}}, thank you for worshipping with us at Grace Chapel today. We look forward to seeing you again!" },
    { name: "Day 2 Follow-up", channel: "WHATSAPP" as const, category: "followup",
      body: "Hi {{firstName}}, it was a joy having you. Is there anything we can pray with you about this week?" },
    { name: "Day 7 Check-in", channel: "WHATSAPP" as const, category: "followup",
      body: "Hello {{firstName}}, how has your week been? We'd love to see you again this Sunday at Grace Chapel." },
    { name: "Day 14 Invitation", channel: "WHATSAPP" as const, category: "invite",
      body: "Hi {{firstName}}, our next service promises to be a blessing. Will you join us this Sunday? We're saving a seat for you." },
    { name: "Day 30 Membership", channel: "WHATSAPP" as const, category: "invite",
      body: "{{firstName}}, we'd love for you to become part of the Grace Chapel family. Reply to learn about our membership class." },
    { name: "Birthday Greeting", channel: "WHATSAPP" as const, category: "birthday",
      body: "Happy Birthday {{firstName}}. We celebrate you today and pray that God grants you greater grace, favour, and blessings." },
    { name: "Anniversary Greeting", channel: "WHATSAPP" as const, category: "anniversary",
      body: "Congratulations on your wedding anniversary {{firstName}}. May God continue to strengthen your home with love, peace, and joy." },
  ];
  const tpl: Record<string, string> = {};
  for (const t of templates) {
    const rec = await db.messageTemplate.upsert({
      where: { churchId_name: { churchId: church.id, name: t.name } },
      update: { body: t.body, category: t.category, channel: t.channel },
      create: { churchId: church.id, ...t },
    });
    tpl[t.name] = rec.id;
  }

  // ── First-timer follow-up workflow ────────────────────────
  const workflow = await db.automationWorkflow.upsert({
    where: { churchId_name: { churchId: church.id, name: "First-Timer Journey" } },
    update: {},
    create: {
      churchId: church.id,
      name: "First-Timer Journey",
      description: "Day 0 → 30 automated welcome & follow-up",
      trigger: "FIRST_TIMER_REGISTERED",
      isActive: true,
    },
  });

  const steps = [
    { order: 1, offsetDays: 0, channel: "WHATSAPP" as const, templateId: tpl["Welcome (WhatsApp)"] },
    { order: 2, offsetDays: 0, channel: "SMS" as const, templateId: tpl["Welcome (SMS)"] },
    { order: 3, offsetDays: 2, channel: "WHATSAPP" as const, templateId: tpl["Day 2 Follow-up"] },
    { order: 4, offsetDays: 7, channel: "WHATSAPP" as const, templateId: tpl["Day 7 Check-in"] },
    { order: 5, offsetDays: 14, channel: "WHATSAPP" as const, templateId: tpl["Day 14 Invitation"] },
    { order: 6, offsetDays: 30, channel: "WHATSAPP" as const, templateId: tpl["Day 30 Membership"] },
  ];
  for (const s of steps) {
    await db.automationStep.upsert({
      where: { workflowId_order: { workflowId: workflow.id, order: s.order } },
      update: { offsetDays: s.offsetDays, channel: s.channel, templateId: s.templateId },
      create: { workflowId: workflow.id, ...s },
    });
  }

  // ── A couple of sample members ────────────────────────────
  await db.member.upsert({
    where: { churchId_phone: { churchId: church.id, phone: "+2348031111111" } },
    update: {},
    create: {
      churchId: church.id,
      branchId: branch.id,
      firstName: "Tunde",
      lastName: "Bakare",
      phone: "+2348031111111",
      gender: "MALE",
      status: "ACTIVE_MEMBER",
      dateOfBirth: new Date("1990-06-07"),
    },
  });

  console.log("✅ Seed complete.");
  console.log("   Login: admin@gracechapel.org / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
