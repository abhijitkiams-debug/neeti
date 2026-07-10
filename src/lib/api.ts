import { NextResponse } from "next/server";
import { AuthError } from "./auth";
import { PolicyStateError } from "./policies";

export function apiError(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof PolicyStateError) return NextResponse.json({ error: e.message }, { status: 409 });
  console.error(e);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
