import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PolicyWorkflowClient } from "./PolicyWorkflowClient";

export default async function AdminPolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.kind !== "employee") redirect("/login");
  const { id } = await params;
  return <PolicyWorkflowClient policyId={id} currentUserId={session.userId} role={session.role} />;
}
