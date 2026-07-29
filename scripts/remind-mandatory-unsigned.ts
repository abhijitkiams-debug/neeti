// Standalone entry point for a scheduled job: `npm run remind:mandatory`.
// Re-notifies everyone with an outstanding mandatory-policy sign-off —
// intended to run daily via cron so unsigned mandatory documents keep
// generating reminders until they're signed.
import { prisma } from "../src/lib/prisma";
import { remindUnsignedMandatory } from "../src/lib/policies";

async function main() {
  const tenants = await prisma.tenant.findMany();
  let totalEmployees = 0;
  let totalVendors = 0;
  for (const tenant of tenants) {
    const result = await remindUnsignedMandatory(tenant.id);
    totalEmployees += result.remindedEmployees;
    totalVendors += result.remindedVendors;
  }
  console.log(`Sent mandatory sign-off reminders to ${totalEmployees} employee(s) and ${totalVendors} vendor user(s) across ${tenants.length} tenant(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Mandatory-reminder job failed:", e);
    process.exit(1);
  });
