import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (err) {
    console.error("[app/layout] getServerSession failed", err);
    redirect("/login");
  }
  if (!session?.user) redirect("/login");

  return <AppShell>{children}</AppShell>;
}
