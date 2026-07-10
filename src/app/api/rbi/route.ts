import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    await requireEmployee();
    const tag = req.nextUrl.searchParams.get("tag");
    const circulars = await prisma.rbiCircular.findMany({
      orderBy: { publishedDate: "desc" },
      take: 200,
    });
    const filtered = tag ? circulars.filter((c) => (JSON.parse(c.tags) as string[]).includes(tag)) : circulars;
    return NextResponse.json({ circulars: filtered.map((c) => ({ ...c, tags: JSON.parse(c.tags) })) });
  } catch (e) {
    return apiError(e);
  }
}
