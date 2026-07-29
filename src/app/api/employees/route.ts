import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { hashPassword } from "@/lib/hash";
import { EMPLOYEE_ROLES } from "@/lib/enums";

export async function GET() {
  try {
    const session = await requireEmployee();
    const employees = await prisma.user.findMany({
      where: { tenantId: session.tenantId },
      select: {
        id: true,
        employeeId: true,
        email: true,
        name: true,
        role: true,
        department: true,
        location: true,
        grade: true,
        designation: true,
        status: true,
        authSource: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ employees });
  } catch (e) {
    return apiError(e);
  }
}

const schema = z.object({
  email: z.string().email(),
  employeeId: z.string().optional(),
  name: z.string().min(1),
  role: z.enum(EMPLOYEE_ROLES),
  department: z.string().optional(),
  location: z.string().optional(),
  grade: z.string().optional(),
  designation: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Manual single-employee creation — the counterpart to the AD sync this
// scaffold doesn't have (see authSource on the User model). Sets
// authSource "MANUAL" just like the seeded demo accounts.
export async function POST(req: Request) {
  try {
    const session = await requireEmployee(["ADMIN"]);
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const existing = await prisma.user.findFirst({ where: { tenantId: session.tenantId, email: body.data.email } });
    if (existing) return NextResponse.json({ error: "An employee with that email already exists" }, { status: 409 });

    if (body.data.employeeId) {
      const dupe = await prisma.user.findFirst({ where: { tenantId: session.tenantId, employeeId: body.data.employeeId } });
      if (dupe) return NextResponse.json({ error: "An employee with that employee ID already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(body.data.password);
    const employee = await prisma.user.create({
      data: {
        tenantId: session.tenantId,
        email: body.data.email,
        employeeId: body.data.employeeId || null,
        name: body.data.name,
        role: body.data.role,
        department: body.data.department || null,
        location: body.data.location || null,
        grade: body.data.grade || null,
        designation: body.data.designation || null,
        passwordHash,
        authSource: "MANUAL",
      },
    });
    return NextResponse.json({ employee }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
