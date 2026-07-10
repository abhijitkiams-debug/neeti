export function clientIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? undefined;
}

export function clientUserAgent(req: Request): string | undefined {
  return req.headers.get("user-agent") ?? undefined;
}
