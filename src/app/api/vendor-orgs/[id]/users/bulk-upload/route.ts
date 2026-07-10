import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, requireVendor, AuthError } from "@/lib/auth";
import { bulkUploadVendorUsers } from "@/lib/vendor-upload";
import { writeAuditLog } from "@/lib/audit";

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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await bulkUploadVendorUsers({
      tenantId,
      vendorOrgId,
      uploadedById: actorId,
      fileName: file.name,
      buffer,
    });

    await writeAuditLog({
      tenantId,
      actorType: "USER",
      actorId,
      action: "VENDOR_USERS_BULK_UPLOADED",
      entityType: "VendorOrg",
      entityId: vendorOrgId,
      metadata: { fileName: file.name, successCount: result.successCount, errorCount: result.errors.length },
    });

    return NextResponse.json({ batch: result.batch, successCount: result.successCount, errors: result.errors });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
