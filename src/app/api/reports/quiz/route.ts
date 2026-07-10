import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

// Per-user and per-team (department / vendor org) quiz scoring.
export async function GET() {
  try {
    const session = await requireEmployee(["ADMIN", "PUBLISHER"]);

    const assignments = await prisma.quizAssignment.findMany({
      where: {
        answeredAt: { not: null },
        OR: [{ user: { tenantId: session.tenantId } }, { vendorUser: { tenantId: session.tenantId } }],
      },
      include: { user: true, vendorUser: { include: { vendorOrg: true } } },
    });

    type Bucket = { name: string; team: string; answered: number; correct: number };
    const byUser = new Map<string, Bucket>();
    const byTeam = new Map<string, { answered: number; correct: number }>();

    for (const a of assignments) {
      const key = a.userId ?? a.vendorUserId!;
      const name = a.user?.name ?? a.vendorUser?.name ?? "Unknown";
      const team = a.user?.department ?? a.vendorUser?.vendorOrg.name ?? "Unassigned";

      const userBucket = byUser.get(key) ?? { name, team, answered: 0, correct: 0 };
      userBucket.answered++;
      if (a.isCorrect) userBucket.correct++;
      byUser.set(key, userBucket);

      const teamBucket = byTeam.get(team) ?? { answered: 0, correct: 0 };
      teamBucket.answered++;
      if (a.isCorrect) teamBucket.correct++;
      byTeam.set(team, teamBucket);
    }

    return NextResponse.json({
      byUser: [...byUser.values()].map((u) => ({ ...u, accuracy: u.answered ? Math.round((u.correct / u.answered) * 100) : 0 })),
      byTeam: [...byTeam.entries()].map(([team, s]) => ({ team, ...s, accuracy: s.answered ? Math.round((s.correct / s.answered) * 100) : 0 })),
    });
  } catch (e) {
    return apiError(e);
  }
}
