import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { getExpiringSoon } from "@/lib/policies";

export async function GET(req: NextRequest) {
  try {
    const session = await requireEmployee(["ADMIN", "PUBLISHER"]);
    const days = Number(req.nextUrl.searchParams.get("days") ?? "30");
    const rows = await getExpiringSoon(session.tenantId, days);
    return NextResponse.json({ rows });
  } catch (e) {
    return apiError(e);
  }
}
