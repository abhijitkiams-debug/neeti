import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.kind === "employee" && ["ADMIN", "PUBLISHER"].includes(session.role)) redirect("/admin");
  redirect("/portal");
}
