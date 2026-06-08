import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handle, HttpError } from "@/lib/tenant";
import { buildReport, toCsv, REPORTS, type ReportType } from "@/lib/reports";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const VALID = new Set(REPORTS.map((r) => r.type));

// GET /api/reports?type=members&format=json|csv
export async function GET(req: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("report:read");
    const type = req.nextUrl.searchParams.get("type") as ReportType;
    const format = req.nextUrl.searchParams.get("format") ?? "json";
    if (!type || !VALID.has(type)) throw new HttpError(422, "Unknown report type");

    const table = await buildReport(ctx.churchId, type);

    if (format === "csv") {
      await audit({
        churchId: ctx.churchId,
        userId: ctx.userId,
        action: "EXPORT",
        entity: "Report",
        description: `Exported ${type} report (${table.rows.length} rows)`,
      });
      return new NextResponse(toCsv(table), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ ...table, count: table.rows.length });
  });
}
