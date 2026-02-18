import superjson from 'superjson';
import { initTRPC, TRPCError } from '@trpc/server';
import { getToken } from 'next-auth/jwt';
import { DEV_SESSION } from '@/server/auth';
import type { NextRequest } from 'next/server';

export const createTRPCContext = async (opts: { req: NextRequest }) => {
  let session: import('next-auth').Session | null = null;
  try {
    // DEV_BYPASS_AUTH: use fake dev session when enabled
    if (DEV_SESSION) {
      session = DEV_SESSION;
    } else {
      // Read the JWT directly from the request cookies — this works reliably
      // inside tRPC's fetch adapter (unlike `auth()` which depends on Next.js
      // async request context that doesn't propagate here).
      const token = await getToken({
        req: opts.req,
        secret: process.env.AUTH_SECRET,
      });
      if (token) {
        session = {
          user: {
            id: token.id as string,
            name: token.name ?? null,
            email: token.email ?? null,
            role: token.role as string,
          },
          expires: new Date(
            (token.exp as number) * 1000,
          ).toISOString(),
        } as import('next-auth').Session;
      }
    }
  } catch (_e) {
    // Ignore session errors (e.g. bad cookies) to allow public procedures
  }
  return {
    headers: opts.req.headers,
    session,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      session: ctx.session,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
