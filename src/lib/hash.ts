import crypto from "crypto";
import bcrypt from "bcryptjs";

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/** 6-digit numeric OTP. Not cryptographically sensitive by itself — the
 * hash + short expiry + attempt limiting is what protects it. */
export function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}
