import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { policyVersionExportRows, rowsToCsv } from "@/lib/reports";

export async function GET(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee(["ADMIN", "PUBLISHER"]);
    const { versionId } = await params;
    const version = await prisma.policyVersion.findFirstOrThrow({
      where: { id: versionId, policy: { tenantId: session.tenantId } },
      include: { policy: true },
    });
    const rows = await policyVersionExportRows(versionId);
    const csv = rowsToCsv(rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${version.policy.slug}-v${version.versionNumber}-audit.csv"`,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
