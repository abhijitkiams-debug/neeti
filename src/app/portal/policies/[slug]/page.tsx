import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { visiblePolicyIdsFor } from "@/lib/consumption";
import { PolicyDetailClient } from "./PolicyDetailClient";

export default async function PolicyWebviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { slug } = await params;

  const policy = await prisma.policy.findFirst({ where: { slug }, include: { family: true, currentVersion: true } });
  if (!policy || !policy.currentVersionId) notFound();

  const visibleIds = await visiblePolicyIdsFor(session);
  if (!visibleIds.includes(policy.id)) notFound();

  const quizCount = await prisma.quizQuestion.count({ where: { policyId: policy.id, active: true } });

  return (
    <PolicyDetailClient
      slug={slug}
      sessionKind={session.kind}
      title={policy.title}
      family={policy.family.name}
      quizCount={quizCount}
    />
  );
}
