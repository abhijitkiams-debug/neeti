import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import type { EmployeeRole, VendorRole } from "./enums";

const SESSION_COOKIE = "neeti_session";
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

export type EmployeeSession = {
  kind: "employee";
  userId: string;
  tenantId: string;
  role: EmployeeRole;
  name: string;
  email: string;
};

export type VendorSession = {
  kind: "vendor";
  vendorUserId: string;
  vendorOrgId: string;
  tenantId: string;
  role: VendorRole;
  name: string;
  mobile: string;
};

export type Session = EmployeeSession | VendorSession;

export async function createSession(payload: Session) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as Session;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AuthError("Not authenticated", 401);
  return session;
}

export async function requireEmployee(roles?: EmployeeRole[]): Promise<EmployeeSession> {
  const session = await requireSession();
  if (session.kind !== "employee") throw new AuthError("Employee session required", 403);
  if (roles && !roles.includes(session.role)) {
    throw new AuthError(`Requires role: ${roles.join(", ")}`, 403);
  }
  return session;
}

export async function requireVendor(roles?: VendorRole[]): Promise<VendorSession> {
  const session = await requireSession();
  if (session.kind !== "vendor") throw new AuthError("Vendor session required", 403);
  if (roles && !roles.includes(session.role)) {
    throw new AuthError(`Requires role: ${roles.join(", ")}`, 403);
  }
  return session;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}
