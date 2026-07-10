import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/hash";
import { COLLECTIONS_RECOVERY_CHECKLIST } from "../src/lib/seed-data/collections-recovery-checklist";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "acme-financial" },
    update: {},
    create: { name: "Acme Financial Services", slug: "acme-financial" },
  });

  const families = await Promise.all(
    ["Business", "Ops", "Collections", "HR"].map((name, i) =>
      prisma.policyFamily.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name } },
        update: {},
        create: { tenantId: tenant.id, name, sortOrder: i },
      })
    )
  );
  const [business, , collections] = families;

  const pw = await hashPassword("admin1234");

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@acme.test" } },
    update: { passwordHash: pw },
    create: { tenantId: tenant.id, email: "admin@acme.test", name: "Asha Admin", role: "ADMIN", passwordHash: pw, department: "Compliance", location: "Mumbai", grade: "M4", designation: "Head of Compliance" },
  });

  const publisher = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "publisher@acme.test" } },
    update: { passwordHash: pw },
    create: { tenantId: tenant.id, email: "publisher@acme.test", name: "Priya Publisher", role: "PUBLISHER", passwordHash: pw, department: "Compliance", location: "Mumbai", grade: "M3", designation: "Compliance Manager" },
  });

  const author = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "author@acme.test" } },
    update: { passwordHash: pw },
    create: { tenantId: tenant.id, email: "author@acme.test", name: "Arjun Author", role: "AUTHOR", passwordHash: pw, department: "Compliance", location: "Bengaluru", grade: "M2", designation: "Policy Author" },
  });

  const employee = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "employee@acme.test" } },
    update: { passwordHash: pw },
    create: { tenantId: tenant.id, email: "employee@acme.test", name: "Esha Employee", role: "EMPLOYEE", passwordHash: pw, department: "Collections", location: "Delhi", grade: "M1", designation: "Collections Officer" },
  });

  const vendorOrg = await prisma.vendorOrg.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Reliable Recovery Agency" } },
    update: {},
    create: { tenantId: tenant.id, name: "Reliable Recovery Agency", type: "AGENCY", region: "North", category: "Collections" },
  });

  const vendorAdmin = await prisma.vendorUser.upsert({
    where: { tenantId_mobile: { tenantId: tenant.id, mobile: "9800000001" } },
    update: {},
    create: { tenantId: tenant.id, vendorOrgId: vendorOrg.id, name: "Vikram Vendor-Admin", mobile: "9800000001", role: "VENDOR_ADMIN", geography: "Delhi-NCR" },
  });

  const vendorUser = await prisma.vendorUser.upsert({
    where: { tenantId_mobile: { tenantId: tenant.id, mobile: "9800000002" } },
    update: {},
    create: { tenantId: tenant.id, vendorOrgId: vendorOrg.id, name: "Farhan Field-Agent", mobile: "9800000002", role: "VENDOR_USER", geography: "Delhi-NCR" },
  });

  // A published policy targeted at Collections dept employees + the vendor org.
  const policy = await prisma.policy.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "code-of-conduct-ethics-policy" } },
    update: {},
    create: { tenantId: tenant.id, familyId: business.id, title: "Code of Conduct & Ethics Policy", slug: "code-of-conduct-ethics-policy" },
  });

  let version = await prisma.policyVersion.findFirst({ where: { policyId: policy.id, versionNumber: 1 } });
  if (!version) {
    version = await prisma.policyVersion.create({
      data: {
        policyId: policy.id,
        versionNumber: 1,
        contentHtml: `<h2>Purpose</h2><p id="purpose">This Code of Conduct &amp; Ethics Policy establishes the standards of professional behavior expected from all employees, directors, and representatives of the Company.</p><h2>Scope</h2><p id="scope">Applies to all employees and empanelled vendor personnel.</p><h2>Key Principles</h2><ul><li>Act with integrity and honesty</li><li>Avoid conflicts of interest</li><li>Protect confidential information</li><li>Comply with all applicable laws and regulations</li></ul>`,
        sourceType: "WYSIWYG",
        status: "DRAFT",
        authorId: author.id,
      },
    });
  }

  if (version.status === "DRAFT") {
    await prisma.approvalAction.create({ data: { policyVersionId: version.id, actorId: author.id, action: "SUBMIT" } });
    version = await prisma.policyVersion.update({
      where: { id: version.id },
      data: { status: "APPROVED", approverId: publisher.id, approvalComment: "Looks good" },
    });
    await prisma.approvalAction.create({ data: { policyVersionId: version.id, actorId: publisher.id, action: "APPROVE", comment: "Looks good" } });

    await prisma.targetRule.createMany({
      data: [
        { policyVersionId: version.id, kind: "EMPLOYEE_ATTRIBUTE", attribute: "department", values: JSON.stringify(["Collections"]) },
        { policyVersionId: version.id, kind: "VENDOR_ATTRIBUTE", attribute: "vendorOrg", values: JSON.stringify([vendorOrg.id]) },
      ],
    });

    await prisma.audienceMember.createMany({
      data: [
        { policyVersionId: version.id, userId: employee.id },
        { policyVersionId: version.id, vendorUserId: vendorAdmin.id },
        { policyVersionId: version.id, vendorUserId: vendorUser.id },
      ],
    });

    version = await prisma.policyVersion.update({ where: { id: version.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    await prisma.policy.update({ where: { id: policy.id }, data: { currentVersionId: version.id } });
  }

  const existingQuestionIds = (await prisma.quizQuestion.findMany({ where: { policyId: policy.id }, select: { id: true } })).map((q) => q.id);
  await prisma.quizAssignment.deleteMany({ where: { questionId: { in: existingQuestionIds } } });
  await prisma.quizOption.deleteMany({ where: { questionId: { in: existingQuestionIds } } });
  await prisma.quizQuestion.deleteMany({ where: { policyId: policy.id } });
  await prisma.quizQuestion.create({
    data: {
      policyId: policy.id,
      questionText: "What should you do if you identify a potential conflict of interest?",
      explanation: "The Code requires prompt disclosure of any conflict of interest to your manager or the Ethics Officer.",
      sectionAnchor: "scope",
      createdById: author.id,
      options: {
        create: [
          { text: "Disclose it promptly to your manager or Ethics Officer", isCorrect: true },
          { text: "Ignore it if it doesn't affect your work directly", isCorrect: false },
          { text: "Handle it privately without informing anyone", isCorrect: false },
          { text: "Wait until year-end review to mention it", isCorrect: false },
        ],
      },
    },
  });
  await prisma.quizQuestion.create({
    data: {
      policyId: policy.id,
      questionText: "Who does the Code of Conduct & Ethics Policy apply to?",
      explanation: "It applies to all employees, directors, and empanelled vendor personnel.",
      sectionAnchor: "scope",
      createdById: author.id,
      options: {
        create: [
          { text: "Only full-time employees", isCorrect: false },
          { text: "Only senior management", isCorrect: false },
          { text: "All employees, directors, and empanelled vendor personnel", isCorrect: true },
          { text: "Only the Compliance department", isCorrect: false },
        ],
      },
    },
  });

  const existingChecklist = await prisma.coverageChecklistItem.findFirst({ where: { tenantId: tenant.id, sourceTemplate: "COLLECTIONS_RECOVERY" } });
  if (!existingChecklist) {
    await prisma.coverageChecklistItem.createMany({
      data: COLLECTIONS_RECOVERY_CHECKLIST.map((item) => ({
        tenantId: tenant.id,
        familyId: collections.id,
        itemName: item.itemName,
        mandatory: item.mandatory,
        sourceTemplate: "COLLECTIONS_RECOVERY",
      })),
    });
  }

  console.log("Seed complete.");
  console.log("Employee logins (password: admin1234):");
  console.log(`  Admin:     ${admin.email}`);
  console.log(`  Publisher: ${publisher.email}`);
  console.log(`  Author:    ${author.email}`);
  console.log(`  Employee:  ${employee.email}`);
  console.log("Vendor logins (OTP; dev mode echoes the code in the API response):");
  console.log(`  Vendor Admin: ${vendorAdmin.mobile}`);
  console.log(`  Vendor User:  ${vendorUser.mobile}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
