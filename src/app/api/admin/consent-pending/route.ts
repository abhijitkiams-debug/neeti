import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { getPendingConsent } from "@/lib/consent";

export async function GET() {
  try {
    const session = await requireEmployee(["ADMIN", "PUBLISHER"]);
    const rows = await getPendingConsent(session.tenantId);
    return NextResponse.json({ rows });
  } catch (e) {
    return apiError(e);
  }
}
