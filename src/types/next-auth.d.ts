import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      plan: string;
      /** Unix seconds when the user last authenticated (login). */
      authTime?: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    plan?: string;
    sessionVersion?: number;
    authTime?: number;
  }
}
