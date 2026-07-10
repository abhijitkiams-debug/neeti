import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

const schema = z.object({ implementationDeadline: z.string().datetime().nullable() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEmployee(["ADMIN"]);
    const { id } = await params;
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const circular = await prisma.rbiCircular.update({
      where: { id },
      data: { implementationDeadline: body.data.implementationDeadline ? new Date(body.data.implementationDeadline) : null },
    });
    return NextResponse.json({ circular });
  } catch (e) {
    return apiError(e);
  }
}
