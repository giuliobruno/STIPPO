import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { verifyPassword } from "@/lib/password";

const isProd = process.env.NODE_ENV === "production";

function resolvePlan(dbUser: {
  plan: string;
  stripeStatus: string | null;
}): "free" | "pro" | "team" {
  if (
    dbUser.plan === "pro" ||
    dbUser.plan === "team" ||
    dbUser.stripeStatus === "active" ||
    dbUser.stripeStatus === "trialing"
  ) {
    return dbUser.plan === "team" ? "team" : "pro";
  }
  return "free";
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  useSecureCookies: isProd,
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const { prisma } = await import("@/lib/prisma");
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user?.passwordHash) return null;
        const ok = await verifyPassword(credentials.password, user.passwordHash);
        if (!ok) return null;
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const { prisma } = await import("@/lib/prisma");
        const email = user.email.toLowerCase();
        let dbUser = await prisma.user.findUnique({ where: { email } });
        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              email,
              name: user.name,
              image: user.image,
              emailVerified: new Date(),
            },
          });
        } else {
          // Google proves email ownership: verify + clear any unverified password
          // that an attacker may have planted before the real owner signed in.
          const patch: {
            emailVerified?: Date;
            passwordHash?: null;
            name?: string | null;
            image?: string | null;
          } = {};
          if (!dbUser.emailVerified) {
            patch.emailVerified = new Date();
            if (dbUser.passwordHash) patch.passwordHash = null;
          }
          if (!dbUser.name && user.name) patch.name = user.name;
          if (!dbUser.image && user.image) patch.image = user.image;
          if (Object.keys(patch).length) {
            dbUser = await prisma.user.update({
              where: { id: dbUser.id },
              data: patch,
            });
          }
        }

        if (account.providerAccountId) {
          // Never persist Google access/refresh tokens — login identity only.
          await prisma.account.upsert({
            where: {
              provider_providerAccountId: {
                provider: "google",
                providerAccountId: account.providerAccountId,
              },
            },
            create: {
              userId: dbUser.id,
              type: account.type,
              provider: "google",
              providerAccountId: account.providerAccountId,
              access_token: null,
              refresh_token: null,
              expires_at: null,
              token_type: null,
              scope: account.scope ?? null,
              id_token: null,
              session_state: null,
            },
            update: {
              access_token: null,
              refresh_token: null,
              expires_at: null,
              id_token: null,
              scope: account.scope ?? null,
              session_state: null,
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      const { prisma } = await import("@/lib/prisma");

      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
        });
        if (dbUser) {
          token.uid = dbUser.id;
          token.plan = resolvePlan(dbUser);
          token.sessionVersion = dbUser.sessionVersion;
          token.authTime = Math.floor(Date.now() / 1000);
        }
        return token;
      }

      if (!token.uid) return token;

      const dbUser = await prisma.user.findUnique({
        where: { id: token.uid as string },
        select: {
          id: true,
          plan: true,
          stripeStatus: true,
          sessionVersion: true,
        },
      });

      if (!dbUser) {
        // User deleted — invalidate token
        delete token.uid;
        delete token.plan;
        delete token.sessionVersion;
        return token;
      }

      if (
        typeof token.sessionVersion === "number" &&
        token.sessionVersion !== dbUser.sessionVersion
      ) {
        delete token.uid;
        delete token.plan;
        delete token.sessionVersion;
        return token;
      }

      // Always refresh plan from DB (billing can change anytime)
      token.plan = resolvePlan(dbUser);
      token.sessionVersion = dbUser.sessionVersion;

      if (trigger === "update" && !token.authTime) {
        token.authTime = Math.floor(Date.now() / 1000);
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.uid) {
        return {
          ...session,
          user: {
            id: "",
            email: null,
            name: null,
            image: null,
            plan: "free",
          },
        };
      }
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.plan = (token.plan as string) || "free";
        session.user.authTime =
          typeof token.authTime === "number" ? token.authTime : undefined;
      }
      return session;
    },
  },
};
