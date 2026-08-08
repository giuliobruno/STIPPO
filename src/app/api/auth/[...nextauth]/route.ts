import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

if (!process.env.NEXTAUTH_SECRET) {
  console.error("[next-auth] NEXTAUTH_SECRET is missing at runtime");
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
