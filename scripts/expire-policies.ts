// Standalone entry point for a scheduled job: `npm run policies:expire`.
// Auto-unpublishes any PUBLISHED policy version whose expiresAt has passed.
import { prisma } from "../src/lib/prisma";
import { autoExpirePastDue } from "../src/lib/policies";

async function main() {
  const tenants = await prisma.tenant.findMany();
  let total = 0;
  for (const tenant of tenants) {
    total += await autoExpirePastDue(tenant.id);
  }
  console.log(`Auto-expired ${total} policy version(s) across ${tenants.length} tenant(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Expiry job failed:", e);
    process.exit(1);
  });
