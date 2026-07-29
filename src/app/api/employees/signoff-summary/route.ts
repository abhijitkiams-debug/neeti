import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { getEmployeeSignoffSummary } from "@/lib/signoff";

export async function GET() {
  try {
    const session = await requireEmployee();
    const summary = await getEmployeeSignoffSummary(session.tenantId);
    return NextResponse.json(summary);
  } catch (e) {
    return apiError(e);
  }
}
