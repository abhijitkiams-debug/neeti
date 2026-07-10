import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { verifyAuditChain } from "@/lib/audit";

export async function GET() {
  try {
    const session = await requireEmployee(["ADMIN"]);
    const result = await verifyAuditChain(session.tenantId);
    return NextResponse.json(result);
  } catch (e) {
    return apiError(e);
  }
}
