import { db } from "@/lib/db";
import { fullName, formatDate } from "@/lib/utils";

export type ReportType =
  | "first-timers"
  | "members"
  | "attendance"
  | "follow-ups"
  | "cell-groups";

export const REPORTS: { type: ReportType; label: string; description: string }[] = [
  { type: "first-timers", label: "First Timers", description: "All guests and conversion status" },
  { type: "members", label: "Members", description: "Full membership directory" },
  { type: "attendance", label: "Attendance", description: "Per-service attendance totals" },
  { type: "follow-ups", label: "Follow-ups", description: "Follow-up tasks and outcomes" },
  { type: "cell-groups", label: "Cell Groups", description: "Groups, leaders and sizes" },
];

interface Table {
  columns: string[];
  rows: (string | number)[][];
}

export async function buildReport(churchId: string, type: ReportType): Promise<Table> {
  switch (type) {
    case "first-timers": {
      const rows = await db.firstTimer.findMany({
        where: { churchId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
      return {
        columns: ["Name", "Phone", "Email", "Invited by", "Registered", "Converted"],
        rows: rows.map((r) => [
          fullName(r), r.phone, r.email ?? "", r.invitedByName ?? "",
          formatDate(r.createdAt), r.isConverted ? "Yes" : "No",
        ]),
      };
    }
    case "members": {
      const rows = await db.member.findMany({
        where: { churchId, deletedAt: null },
        include: { cellGroup: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        columns: ["Name", "Phone", "Email", "Status", "Cell group", "Joined"],
        rows: rows.map((r) => [
          fullName(r), r.phone, r.email ?? "", r.status.replace("_", " "),
          r.cellGroup?.name ?? "", formatDate(r.joinedAt),
        ]),
      };
    }
    case "attendance": {
      const rows = await db.service.findMany({
        where: { churchId },
        orderBy: { date: "desc" },
        take: 200,
      });
      return {
        columns: ["Service", "Type", "Date", "Attendees", "First timers"],
        rows: rows.map((r) => [
          r.name, r.type.replace("_", " "), formatDate(r.date), r.totalAttendees, r.totalFirstTimers,
        ]),
      };
    }
    case "follow-ups": {
      const rows = await db.followUp.findMany({
        where: { churchId },
        include: {
          member: { select: { firstName: true, lastName: true } },
          firstTimer: { select: { firstName: true, lastName: true } },
          assignedTo: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      return {
        columns: ["Person", "Type", "Status", "Outcome", "Assigned to", "Due"],
        rows: rows.map((r) => {
          const p = r.member ?? r.firstTimer;
          return [
            p ? `${p.firstName} ${p.lastName}` : "—", r.type, r.status,
            r.outcome ?? "", r.assignedTo?.name ?? "", formatDate(r.dueDate),
          ];
        }),
      };
    }
    case "cell-groups": {
      const rows = await db.cellGroup.findMany({
        where: { churchId, deletedAt: null },
        include: { leader: { select: { name: true } }, _count: { select: { members: true } } },
        orderBy: { name: "asc" },
      });
      return {
        columns: ["Group", "Leader", "Members", "Meeting day", "Location"],
        rows: rows.map((r) => [
          r.name, r.leader?.name ?? "", r._count.members, r.meetingDay ?? "", r.location ?? "",
        ]),
      };
    }
  }
}

/** RFC-4180-ish CSV serialisation. */
export function toCsv(table: Table): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [table.columns.map(esc).join(",")];
  for (const row of table.rows) lines.push(row.map(esc).join(","));
  return lines.join("\n");
}
