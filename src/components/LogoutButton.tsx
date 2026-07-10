"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      className={className ?? "text-sm text-slate-500 hover:text-slate-800"}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
