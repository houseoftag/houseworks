import superjson from 'superjson';
import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '@/server/auth';
import type { NextRequest } from 'next/server';

export const createTRPCContext = async (opts: { req: NextRequest }) => {
  let session = null;
  try {
    // NextAuth v5 `auth()` reads request cookies via Next.js request context.
    // Passing `NextRequest` here does not reliably resolve the session for Route Handlers.
    session = await auth();
  } catch (e) {
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
