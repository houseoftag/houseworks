import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Resend from 'next-auth/providers/resend';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare } from 'bcryptjs';
import { type UserRole } from '@prisma/client';
import { prisma } from '@/server/db';

const resendApiKey = process.env.RESEND_API_KEY;
const resendEnabled = Boolean(resendApiKey && resendApiKey !== 're_replace_me');

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  trustHost: true,
  pages: {
    signIn: '/sign-in',
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const email = credentials?.email?.toString().toLowerCase().trim();
        const password = credentials?.password?.toString() ?? '';

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
    ...(resendEnabled
      ? [
          Resend({
            apiKey: resendApiKey,
            from: 'Houseworks <no-reply@houseworks.io>',
          }),
        ]
      : []),
  ],
  callbacks: {
    session: ({ session, token }) => {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
  },
} satisfies NextAuthConfig;

const nextAuth = NextAuth(authConfig);

// ─── DEV AUTH BYPASS ─────────────────────────────────────────────────
// When DEV_BYPASS_AUTH=true, every request is auto-authenticated as a
// test user.  This must NEVER be enabled in production.
const DEV_BYPASS =
  process.env.DEV_BYPASS_AUTH === 'true' &&
  process.env.NODE_ENV !== 'production';

export const DEV_USER = {
  id: 'cmlqnrgse0000qllgyecbq645',
  name: 'Houseworks Admin',
  email: 'admin@houseworks.local',
  role: 'ADMIN' as UserRole,
};

export const DEV_SESSION = DEV_BYPASS
  ? ({
      user: DEV_USER,
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    } as import('next-auth').Session)
  : null;

export const handlers = DEV_BYPASS
  ? {
      ...nextAuth.handlers,
      GET: (req: Request) => {
        // Intercept /api/auth/session to return dev session for client-side useSession()
        const url = new URL(req.url);
        if (url.pathname.endsWith('/session')) {
          return Response.json(DEV_SESSION);
        }
        return nextAuth.handlers.GET(req);
      },
    }
  : nextAuth.handlers;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;

/**
 * Wrapped `auth()` that returns a fake dev session when bypass is active.
 */
export const auth: typeof nextAuth.auth = DEV_BYPASS
  ? ((...args: Parameters<typeof nextAuth.auth>) => {
      // If called as a middleware wrapper (with a function arg), invoke it with the fake session
      if (typeof args[0] === 'function') {
        const handler = args[0] as (req: any) => any;
        return ((req: any) => {
          (req as any).auth = DEV_SESSION;
          return handler(req);
        }) as any;
      }
      // Otherwise return the fake session directly
      return Promise.resolve(DEV_SESSION) as any;
    }) as typeof nextAuth.auth
  : nextAuth.auth;
