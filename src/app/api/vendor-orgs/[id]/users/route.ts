import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee, requireVendor, AuthError } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { VENDOR_ROLES } from "@/lib/enums";

const schema = z.object({
  name: z.string().min(1),
  mobile: z.string().regex(/^\+?[0-9]{6,15}$/, "Invalid mobile number"),
  email: z.string().email().optional().or(z.literal("")),
  vendorUserCode: z.string().optional(),
  role: z.enum(VENDOR_ROLES),
  geography: z.string().optional(),
});

// Manual single vendor-user creation — the counterpart to the CSV/XLSX
// bulk-upload path for adding one person at a time.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: vendorOrgId } = await params;
  try {
    let tenantId: string;
    let actorId: string;
    try {
      const employee = await requireEmployee(["ADMIN"]);
      tenantId = employee.tenantId;
      actorId = employee.userId;
    } catch {
      const vendorSession = await requireVendor(["VENDOR_ADMIN"]);
      if (vendorSession.vendorOrgId !== vendorOrgId) throw new AuthError("Forbidden", 403);
      tenantId = vendorSession.tenantId;
      actorId = vendorSession.vendorUserId;
    }

    const org = await prisma.vendorOrg.findFirst({ where: { id: vendorOrgId, tenantId } });
    if (!org) return NextResponse.json({ error: "Vendor org not found" }, { status: 404 });

    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const existing = await prisma.vendorUser.findFirst({ where: { tenantId, mobile: body.data.mobile } });
    if (existing) return NextResponse.json({ error: "A vendor user with that mobile number already exists" }, { status: 409 });

    const vendorUser = await prisma.vendorUser.create({
      data: {
        tenantId,
        vendorOrgId,
        name: body.data.name,
        mobile: body.data.mobile,
        email: body.data.email || null,
        vendorUserCode: body.data.vendorUserCode || null,
        role: body.data.role,
        geography: body.data.geography || null,
      },
    });

    await writeAuditLog({
      tenantId,
      actorType: "USER",
      actorId,
      action: "VENDOR_USER_ADDED",
      entityType: "VendorUser",
      entityId: vendorUser.id,
      metadata: { mobile: vendorUser.mobile },
    });

    return NextResponse.json({ vendorUser }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
