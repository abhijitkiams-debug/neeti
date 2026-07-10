import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { seedCollectionsRecoveryTemplate } from "@/lib/coverage";

export async function POST() {
  try {
    const session = await requireEmployee(["ADMIN"]);
    const result = await seedCollectionsRecoveryTemplate(session.tenantId);
    return NextResponse.json(result);
  } catch (e) {
    return apiError(e);
  }
}
