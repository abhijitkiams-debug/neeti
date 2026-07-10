import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/hash";
import { createSession } from "@/lib/auth";
import { apiError } from "@/lib/api";

// Placeholder for AD/SAML SSO (explicitly out of scope for this build).
// In production this route is replaced by a SAML/OIDC callback handler
// that trusts Active Directory as the identity source; the session shape
// (EmployeeSession) is unchanged, so downstream code needs no rework.
const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const { email, password } = body.data;
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user || user.status !== "ACTIVE" || !user.passwordHash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    await createSession({
      kind: "employee",
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role as never,
      name: user.name,
      email: user.email,
    });

    return NextResponse.json({ id: user.id, name: user.name, role: user.role });
  } catch (e) {
    return apiError(e);
  }
}
