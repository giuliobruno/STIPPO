import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { LandingView } from "@/components/LandingView";

export default async function LandingPage({
  searchParams,
}: {
  searchParams?: { deleted?: string; welcome?: string };
}) {
  const showLandingAnyway = searchParams?.welcome === "1";
  let signedIn = false;

  try {
    const session = await getServerSession(authOptions);
    signedIn = Boolean(session?.user);
    // Registered users skip the landing on app open; title click uses ?welcome=1
    if (signedIn && !showLandingAnyway) redirect("/app");
  } catch (err) {
    // Never take down the marketing page if session/auth misconfigured.
    console.error("[landing] getServerSession failed", err);
  }

  return (
    <LandingView
      deleted={searchParams?.deleted === "1"}
      signedIn={signedIn}
    />
  );
}
