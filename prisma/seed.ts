import { PrismaClient } from "@prisma/client";
import { hashPassword, sha256 } from "../src/lib/hash";
import { COLLECTIONS_RECOVERY_CHECKLIST } from "../src/lib/seed-data/collections-recovery-checklist";
import { submitForReview, approveVersion, setTargetRules, publishVersion } from "../src/lib/policies";
import type { TargetRuleInput } from "../src/lib/targeting";
import { scrapeAndStore } from "../src/lib/rbi-scraper";

const prisma = new PrismaClient();

const DEPARTMENTS = ["Compliance", "Collections", "Sales", "Operations", "HR", "IT", "Finance", "Legal"];

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function daysFromNow(n: number) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}
function fakeIp() {
  return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1",
];
function fakeUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

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
  const [business, ops, collections, hr] = families;

  const pw = await hashPassword("admin1234");

  async function ensureEmployee(opts: {
    email: string;
    name: string;
    role: string;
    department: string;
    location: string;
    grade: string;
    designation: string;
  }) {
    return prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: opts.email } },
      update: { passwordHash: pw },
      create: { tenantId: tenant.id, passwordHash: pw, ...opts },
    });
  }

  const admin = await ensureEmployee({ email: "admin@acme.test", name: "Asha Admin", role: "ADMIN", department: "Compliance", location: "Mumbai", grade: "M4", designation: "Head of Compliance" });
  const publisher = await ensureEmployee({ email: "publisher@acme.test", name: "Priya Publisher", role: "PUBLISHER", department: "Compliance", location: "Mumbai", grade: "M3", designation: "Compliance Manager" });
  const author = await ensureEmployee({ email: "author@acme.test", name: "Arjun Author", role: "AUTHOR", department: "Compliance", location: "Bengaluru", grade: "M2", designation: "Policy Author" });
  const employee = await ensureEmployee({ email: "employee@acme.test", name: "Esha Employee", role: "EMPLOYEE", department: "Collections", location: "Delhi", grade: "M1", designation: "Collections Officer" });
  const rohan = await ensureEmployee({ email: "rohan.sales@acme.test", name: "Rohan Kapoor", role: "EMPLOYEE", department: "Sales", location: "Chennai", grade: "M1", designation: "Sales Executive" });
  const priyanka = await ensureEmployee({ email: "priyanka.ops@acme.test", name: "Priyanka Rao", role: "EMPLOYEE", department: "Operations", location: "Pune", grade: "M2", designation: "Operations Manager" });
  const kabir = await ensureEmployee({ email: "kabir.hr@acme.test", name: "Kabir Mehta", role: "EMPLOYEE", department: "HR", location: "Hyderabad", grade: "M1", designation: "HR Executive" });
  const neha = await ensureEmployee({ email: "neha.it@acme.test", name: "Neha Sharma", role: "EMPLOYEE", department: "IT", location: "Bengaluru", grade: "M2", designation: "IT Systems Lead" });
  const vivek = await ensureEmployee({ email: "vivek.finance@acme.test", name: "Vivek Nair", role: "EMPLOYEE", department: "Finance", location: "Mumbai", grade: "M3", designation: "Finance Controller" });
  const divya = await ensureEmployee({ email: "divya.legal@acme.test", name: "Divya Iyer", role: "EMPLOYEE", department: "Legal", location: "Delhi", grade: "M2", designation: "Legal Counsel" });
  const allEmployees = [admin, publisher, author, employee, rohan, priyanka, kabir, neha, vivek, divya];

  async function ensureVendorOrg(opts: { name: string; type: string; region: string; category: string }) {
    return prisma.vendorOrg.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: opts.name } },
      update: {},
      create: { tenantId: tenant.id, ...opts },
    });
  }
  async function ensureVendorUser(opts: { vendorOrgId: string; name: string; mobile: string; role: string; geography: string }) {
    return prisma.vendorUser.upsert({
      where: { tenantId_mobile: { tenantId: tenant.id, mobile: opts.mobile } },
      update: {},
      create: { tenantId: tenant.id, ...opts },
    });
  }

  const recoveryAgency = await ensureVendorOrg({ name: "Reliable Recovery Agency", type: "AGENCY", region: "North", category: "Collections" });
  const vendorAdmin = await ensureVendorUser({ vendorOrgId: recoveryAgency.id, name: "Vikram Vendor-Admin", mobile: "9800000001", role: "VENDOR_ADMIN", geography: "Delhi-NCR" });
  const vendorUser = await ensureVendorUser({ vendorOrgId: recoveryAgency.id, name: "Farhan Field-Agent", mobile: "9800000002", role: "VENDOR_USER", geography: "Delhi-NCR" });

  const swiftBpo = await ensureVendorOrg({ name: "Swift Collections BPO", type: "BPO", region: "South", category: "Collections" });
  const swiftAdmin = await ensureVendorUser({ vendorOrgId: swiftBpo.id, name: "Meera Swift", mobile: "9800000003", role: "VENDOR_ADMIN", geography: "Bengaluru" });
  const swiftUser = await ensureVendorUser({ vendorOrgId: swiftBpo.id, name: "Arjun Swift", mobile: "9800000004", role: "VENDOR_USER", geography: "Chennai" });

  const dsaPartners = await ensureVendorOrg({ name: "National DSA Partners", type: "DSA", region: "West", category: "Sales" });
  const dsaAdmin = await ensureVendorUser({ vendorOrgId: dsaPartners.id, name: "Rakesh DSA", mobile: "9800000005", role: "VENDOR_ADMIN", geography: "Mumbai" });
  const dsaUser = await ensureVendorUser({ vendorOrgId: dsaPartners.id, name: "Sana DSA", mobile: "9800000006", role: "VENDOR_USER", geography: "Pune" });

  const allVendorOrgIds = [recoveryAgency.id, swiftBpo.id, dsaPartners.id];

  // ── Policy pipeline: draft -> in-review -> approved -> published, using the
  // real app logic (not hand-rolled duplicate state transitions), so seeded
  // data exercises the exact same code paths as the live app. ──
  async function progressPolicy(opts: {
    familyId: string;
    title: string;
    slug: string;
    contentHtml: string;
    targetState: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED";
    targetRules?: TargetRuleInput[];
    expiresAt?: Date;
  }) {
    return prisma.$transaction(async (tx) => {
      const policy = await tx.policy.upsert({
        where: { tenantId_slug: { tenantId: tenant.id, slug: opts.slug } },
        update: {},
        create: { tenantId: tenant.id, familyId: opts.familyId, title: opts.title, slug: opts.slug },
      });
      let version = await tx.policyVersion.findFirst({ where: { policyId: policy.id, versionNumber: 1 } });
      if (!version) {
        version = await tx.policyVersion.create({
          data: { policyId: policy.id, versionNumber: 1, contentHtml: opts.contentHtml, sourceType: "WYSIWYG", status: "DRAFT", authorId: author.id },
        });
      }
      return { policy, version };
    }).then(async ({ policy, version }) => {
      const order = ["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED"];
      const targetIdx = order.indexOf(opts.targetState);

      if (version.status === "DRAFT" && targetIdx >= 1) {
        await submitForReview(version.id, author.id);
        version = await prisma.policyVersion.findUniqueOrThrow({ where: { id: version.id } });
      }
      if (version.status === "IN_REVIEW" && targetIdx >= 2) {
        await approveVersion(version.id, publisher.id, "Looks good — approved.");
        version = await prisma.policyVersion.findUniqueOrThrow({ where: { id: version.id } });
      }
      if (version.status === "APPROVED" && targetIdx >= 3) {
        if (opts.targetRules) await setTargetRules(version.id, opts.targetRules);
        await publishVersion({ tenantId: tenant.id, versionId: version.id, publisherId: publisher.id, expiresAt: opts.expiresAt });
        version = await prisma.policyVersion.findUniqueOrThrow({ where: { id: version.id } });
      }
      return { policy, version };
    });
  }

  async function addQuizQuestions(policyId: string, questions: { text: string; explanation: string; options: { text: string; isCorrect: boolean }[] }[]) {
    const existingIds = (await prisma.quizQuestion.findMany({ where: { policyId }, select: { id: true } })).map((q) => q.id);
    await prisma.quizAssignment.deleteMany({ where: { questionId: { in: existingIds } } });
    await prisma.quizOption.deleteMany({ where: { questionId: { in: existingIds } } });
    await prisma.quizQuestion.deleteMany({ where: { policyId } });
    for (const q of questions) {
      await prisma.quizQuestion.create({
        data: { policyId, questionText: q.text, explanation: q.explanation, createdById: author.id, options: { create: q.options } },
      });
    }
  }

  // Simulates realistic post-publish engagement: reads, attestations,
  // access logs (with fake IP/UA), feedback and a couple of questions,
  // spread across the days since publish so the report chart isn't flat.
  async function seedEngagement(versionId: string, publishedAt: Date, audience: { userId?: string; vendorUserId?: string }[]) {
    const already = await prisma.readReceipt.findFirst({ where: { policyVersionId: versionId } });
    if (already) return;

    const readCount = Math.max(1, Math.ceil(audience.length * 0.7));
    const dayOffsets = [0.3, 0.8, 1.5, 2.2, 3.5, 6, 9, 15];
    for (let i = 0; i < readCount; i++) {
      const who = audience[i];
      const at = new Date(publishedAt.getTime() + (dayOffsets[i % dayOffsets.length]) * 24 * 60 * 60 * 1000);
      await prisma.readReceipt.create({ data: { policyVersionId: versionId, ...who, readAt: at } });
      await prisma.accessLog.create({ data: { policyVersionId: versionId, ...who, ipAddress: fakeIp(), userAgent: fakeUA(), accessedAt: at } });
      if (Math.random() > 0.4) {
        await prisma.accessLog.create({ data: { policyVersionId: versionId, ...who, ipAddress: fakeIp(), userAgent: fakeUA(), accessedAt: new Date(at.getTime() + 3600_000) } });
      }
    }

    const attestCount = Math.max(1, Math.ceil(readCount * 0.55));
    for (let i = 0; i < attestCount; i++) {
      const who = audience[i];
      const at = new Date(publishedAt.getTime() + (dayOffsets[i % dayOffsets.length]) * 24 * 60 * 60 * 1000 + 1800_000);
      const method = who.userId ? "AD_REVERIFY" : "OTP";
      const recordHash = sha256([versionId, who.userId ?? "", who.vendorUserId ?? "", method, at.toISOString()].join("|"));
      await prisma.attestation.create({ data: { policyVersionId: versionId, ...who, method, signedAt: at, recordHash } });
    }

    if (audience[0]) await prisma.policyFeedback.create({ data: { policyVersionId: versionId, ...audience[0], helpful: true } });
    if (audience[1]) await prisma.policyFeedback.create({ data: { policyVersionId: versionId, ...audience[1], helpful: true } });
    if (audience[2]) await prisma.policyFeedback.create({ data: { policyVersionId: versionId, ...audience[2], helpful: false } });
  }

  // ── Business family ──
  const { policy: codeOfConduct, version: cocVersion } = await progressPolicy({
    familyId: business.id,
    title: "Code of Conduct & Ethics Policy",
    slug: "code-of-conduct-ethics-policy",
    contentHtml: `<h2>Purpose</h2><p id="purpose">This Code of Conduct &amp; Ethics Policy establishes the standards of professional behavior expected from all employees, directors, and representatives of the Company.</p><h2>Scope</h2><p id="scope">Applies to all employees and empanelled vendor personnel.</p><h2>Key Principles</h2><ul><li>Act with integrity and honesty</li><li>Avoid conflicts of interest</li><li>Protect confidential information</li><li>Comply with all applicable laws and regulations</li></ul>`,
    targetState: "PUBLISHED",
    targetRules: [
      { kind: "EMPLOYEE_ATTRIBUTE", attribute: "department", values: ["Collections"] },
      { kind: "VENDOR_ATTRIBUTE", attribute: "vendorOrg", values: [recoveryAgency.id] },
    ],
  });
  await addQuizQuestions(codeOfConduct.id, [
    {
      text: "What should you do if you identify a potential conflict of interest?",
      explanation: "The Code requires prompt disclosure of any conflict of interest to your manager or the Ethics Officer.",
      options: [
        { text: "Disclose it promptly to your manager or Ethics Officer", isCorrect: true },
        { text: "Ignore it if it doesn't affect your work directly", isCorrect: false },
        { text: "Handle it privately without informing anyone", isCorrect: false },
        { text: "Wait until year-end review to mention it", isCorrect: false },
      ],
    },
    {
      text: "Who does the Code of Conduct & Ethics Policy apply to?",
      explanation: "It applies to all employees, directors, and empanelled vendor personnel.",
      options: [
        { text: "Only full-time employees", isCorrect: false },
        { text: "Only senior management", isCorrect: false },
        { text: "All employees, directors, and empanelled vendor personnel", isCorrect: true },
        { text: "Only the Compliance department", isCorrect: false },
      ],
    },
  ]);
  if (cocVersion.publishedAt) {
    await seedEngagement(cocVersion.id, cocVersion.publishedAt, [{ userId: employee.id }, { vendorUserId: vendorAdmin.id }, { vendorUserId: vendorUser.id }]);
  }

  const { policy: dataPrivacy, version: dpVersion } = await progressPolicy({
    familyId: business.id,
    title: "Data Privacy & Protection Policy",
    slug: "data-privacy-protection-policy",
    contentHtml: `<h2>Purpose</h2><p id="purpose">Sets out how the Company collects, uses, and protects personal data of customers, employees, and partners, in line with applicable data protection law.</p><h2>Key Obligations</h2><ul><li>Collect only the data necessary for a stated purpose</li><li>Store data securely and limit access on a need-to-know basis</li><li>Report suspected data breaches within 24 hours</li><li>Honor data subject access and erasure requests</li></ul><h2 id="scope">Scope</h2><p>Applies company-wide, including empanelled vendor personnel who handle customer data.</p>`,
    targetState: "PUBLISHED",
    targetRules: [
      { kind: "EMPLOYEE_ATTRIBUTE", attribute: "department", values: DEPARTMENTS },
      { kind: "VENDOR_ATTRIBUTE", attribute: "vendorOrg", values: allVendorOrgIds },
    ],
  });
  await addQuizQuestions(dataPrivacy.id, [
    {
      text: "Within how long must a suspected data breach be reported?",
      explanation: "Suspected breaches must be escalated within 24 hours per the Data Privacy & Protection Policy.",
      options: [
        { text: "24 hours", isCorrect: true },
        { text: "One week", isCorrect: false },
        { text: "At the next audit", isCorrect: false },
        { text: "Only if a customer complains", isCorrect: false },
      ],
    },
  ]);
  if (dpVersion.publishedAt) {
    await seedEngagement(dpVersion.id, dpVersion.publishedAt, [
      { userId: employee.id }, { userId: rohan.id }, { userId: priyanka.id }, { userId: kabir.id }, { userId: neha.id }, { userId: vivek.id }, { userId: divya.id },
      { vendorUserId: vendorAdmin.id }, { vendorUserId: vendorUser.id }, { vendorUserId: swiftAdmin.id }, { vendorUserId: swiftUser.id }, { vendorUserId: dsaAdmin.id }, { vendorUserId: dsaUser.id },
    ]);
  }

  // ── Collections family ──
  const { policy: fpc, version: fpcVersion } = await progressPolicy({
    familyId: collections.id,
    title: "Fair Practices Code (FPC)",
    slug: "fair-practices-code-fpc",
    contentHtml: `<h2 id="purpose">Purpose</h2><p>Establishes fair, transparent, and non-coercive practices in lending and recovery, in line with RBI's Fair Practices Code guidelines.</p><h2>Key Commitments</h2><ul><li>No contact with borrowers before 0700 hrs or after 1900 hrs</li><li>No use of intimidation or harassment in recovery</li><li>Clear, accurate disclosure of loan terms</li><li>A documented grievance redressal mechanism</li></ul>`,
    targetState: "PUBLISHED",
    targetRules: [
      { kind: "EMPLOYEE_ATTRIBUTE", attribute: "department", values: ["Collections"] },
      { kind: "VENDOR_ATTRIBUTE", attribute: "vendorOrg", values: allVendorOrgIds },
    ],
  });
  if (fpcVersion.publishedAt) {
    await seedEngagement(fpcVersion.id, fpcVersion.publishedAt, [
      { userId: employee.id }, { vendorUserId: vendorAdmin.id }, { vendorUserId: vendorUser.id }, { vendorUserId: swiftAdmin.id }, { vendorUserId: swiftUser.id },
    ]);
  }

  const { policy: recoveryAgentCode, version: racVersion } = await progressPolicy({
    familyId: collections.id,
    title: "Recovery Agent Code of Conduct",
    slug: "recovery-agent-code-of-conduct",
    contentHtml: `<h2 id="purpose">Purpose</h2><p>Defines the standards of conduct expected from every recovery agent acting on the Company's behalf.</p><h2>Rules of Engagement</h2><ul><li>Always carry and present your authorization letter and ID card</li><li>Never visit a borrower's residence before 0700 hrs or after 1900 hrs</li><li>Maintain a civil, professional tone at all times</li><li>Escalate disputes rather than engaging in confrontation</li></ul>`,
    targetState: "PUBLISHED",
    targetRules: [{ kind: "VENDOR_ATTRIBUTE", attribute: "vendorOrg", values: allVendorOrgIds }],
    expiresAt: daysFromNow(18),
  });
  if (racVersion.publishedAt) {
    await seedEngagement(racVersion.id, racVersion.publishedAt, [
      { vendorUserId: vendorAdmin.id }, { vendorUserId: vendorUser.id }, { vendorUserId: swiftAdmin.id }, { vendorUserId: swiftUser.id }, { vendorUserId: dsaAdmin.id }, { vendorUserId: dsaUser.id },
    ]);
  }

  // Link two published policies to their matching coverage checklist items (seeded below).
  await prisma.coverageChecklistItem.updateMany({
    where: { tenantId: tenant.id, itemName: "Fair Practices Code (FPC)" },
    data: { linkedPolicyId: fpc.id },
  });
  await prisma.coverageChecklistItem.updateMany({
    where: { tenantId: tenant.id, itemName: "Recovery Agent Code of Conduct" },
    data: { linkedPolicyId: recoveryAgentCode.id },
  });

  // ── HR family ──
  const { policy: leavePolicy, version: leaveVersion } = await progressPolicy({
    familyId: hr.id,
    title: "Leave & Attendance Policy",
    slug: "leave-attendance-policy",
    contentHtml: `<h2 id="purpose">Purpose</h2><p>Defines leave entitlements, the approval process, and attendance expectations for all employees.</p><h2>Entitlements</h2><ul><li>18 days of privilege leave per year, accrued monthly</li><li>12 days of sick leave per year</li><li>26 weeks of maternity leave; 2 weeks of paternity leave</li></ul>`,
    targetState: "PUBLISHED",
    targetRules: [{ kind: "EMPLOYEE_ATTRIBUTE", attribute: "department", values: DEPARTMENTS }],
  });
  if (leaveVersion.publishedAt) {
    await seedEngagement(leaveVersion.id, leaveVersion.publishedAt, [
      { userId: employee.id }, { userId: rohan.id }, { userId: priyanka.id }, { userId: kabir.id }, { userId: neha.id }, { userId: vivek.id }, { userId: divya.id },
    ]);
  }

  // POSH Policy: approved but deliberately not yet published, to populate a real "ready to publish" item.
  await progressPolicy({
    familyId: hr.id,
    title: "Prevention of Sexual Harassment (POSH) Policy",
    slug: "posh-policy",
    contentHtml: `<h2 id="purpose">Purpose</h2><p>Establishes a zero-tolerance stance on sexual harassment at the workplace and the process for raising and investigating complaints via the Internal Committee (IC).</p>`,
    targetState: "APPROVED",
  });

  // ── Ops family — mid-pipeline items to populate the approval queue and drafts. ──
  await progressPolicy({
    familyId: ops.id,
    title: "Information Security Policy",
    slug: "information-security-policy",
    contentHtml: `<h2 id="purpose">Purpose</h2><p>Defines baseline information security controls: access management, acceptable use, and incident reporting.</p>`,
    targetState: "IN_REVIEW",
  });

  await progressPolicy({
    familyId: ops.id,
    title: "Business Continuity Policy",
    slug: "business-continuity-policy",
    contentHtml: `<h2 id="purpose">Purpose</h2><p>Draft — outlines the Company's approach to maintaining critical operations during a disruption.</p>`,
    targetState: "DRAFT",
  });

  // ── Coverage checklist ──
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
    // Re-link now that the checklist rows exist.
    await prisma.coverageChecklistItem.updateMany({ where: { tenantId: tenant.id, itemName: "Fair Practices Code (FPC)" }, data: { linkedPolicyId: fpc.id } });
    await prisma.coverageChecklistItem.updateMany({ where: { tenantId: tenant.id, itemName: "Recovery Agent Code of Conduct" }, data: { linkedPolicyId: recoveryAgentCode.id } });
  }

  // ── Questions on the two most-visible published policies ──
  const existingQuestions = await prisma.policyQuestion.findFirst({ where: { policyVersionId: cocVersion.id } });
  if (!existingQuestions) {
    await prisma.policyQuestion.create({
      data: {
        policyVersionId: cocVersion.id,
        userId: employee.id,
        questionText: "Does this apply to contract staff too?",
        status: "ANSWERED",
        answerText: "Yes — all employees and empanelled vendor personnel are covered, including contract staff.",
        answeredById: publisher.id,
        answeredAt: daysAgo(1),
      },
    });
    await prisma.policyQuestion.create({
      data: {
        policyVersionId: dpVersion.id,
        vendorUserId: vendorUser.id,
        questionText: "Who do I contact if I suspect a data breach on a customer call?",
        status: "OPEN",
      },
    });
  }

  // ── RBI notifications: try a live scrape (best-effort — network may be
  // restricted in some environments); always ensure a couple of synthetic
  // circulars with implementation deadlines so the dashboard widget has
  // real data even offline. ──
  try {
    await scrapeAndStore(30);
  } catch {
    console.log("RBI live scrape skipped (network unavailable) — seeding synthetic circulars instead.");
  }
  await prisma.rbiCircular.upsert({
    where: { sourceUrl: "https://www.rbi.org.in/seed/master-direction-nbfc-scale-based-regulation" },
    update: {},
    create: {
      title: "Master Direction – Reserve Bank of India (Non-Banking Financial Company – Scale Based Regulation) Directions",
      sourceUrl: "https://www.rbi.org.in/seed/master-direction-nbfc-scale-based-regulation",
      publishedDate: daysAgo(10),
      summary: "RBI notification dated 10 days ago: consolidated scale-based regulatory framework for NBFCs.",
      tags: JSON.stringify(["NBFC"]),
      implementationDeadline: daysFromNow(25),
    },
  });
  await prisma.rbiCircular.upsert({
    where: { sourceUrl: "https://www.rbi.org.in/seed/co-op-bank-cyber-security-framework" },
    update: {},
    create: {
      title: "Cyber Security Framework for Urban Co-operative Banks",
      sourceUrl: "https://www.rbi.org.in/seed/co-op-bank-cyber-security-framework",
      publishedDate: daysAgo(4),
      summary: "RBI notification dated 4 days ago: mandatory cyber security controls for urban co-operative banks.",
      tags: JSON.stringify(["CO_OP_BANK"]),
      implementationDeadline: daysFromNow(60),
    },
  });

  console.log("Seed complete.");
  console.log(`  ${allEmployees.length} employees, 3 vendor orgs (6 vendor users), 8 policies across ${families.length} families.`);
  console.log("Employee logins (password: admin1234):");
  console.log(`  Admin:     ${admin.email}`);
  console.log(`  Publisher: ${publisher.email}`);
  console.log(`  Author:    ${author.email}`);
  console.log(`  Employee:  ${employee.email}  (and 6 more across Sales/Ops/HR/IT/Finance/Legal)`);
  console.log("Vendor logins (OTP; dev mode echoes the code in the API response):");
  console.log(`  Reliable Recovery Agency — Vendor Admin: ${vendorAdmin.mobile}, Vendor User: ${vendorUser.mobile}`);
  console.log(`  Swift Collections BPO    — Vendor Admin: ${swiftAdmin.mobile}, Vendor User: ${swiftUser.mobile}`);
  console.log(`  National DSA Partners    — Vendor Admin: ${dsaAdmin.mobile}, Vendor User: ${dsaUser.mobile}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
