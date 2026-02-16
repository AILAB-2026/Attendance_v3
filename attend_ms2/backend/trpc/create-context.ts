import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";

interface DecodedToken {
  id: string;
  userId: string;
  empNo: string;
  role: string;
  companyCode: string;
}

// Context creation function
export const createContext = async (opts: FetchCreateContextFnOptions) => {
  // Extract authorization header
  const authorization = opts.req.headers.get('authorization');
  let user = null;

  if (authorization) {
    try {
      const token = authorization.replace('Bearer ', '');
      const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
      user = {
        id: decoded.id,
        userId: decoded.userId,
        empNo: decoded.empNo,
        role: decoded.role,
        companyCode: decoded.companyCode,
      };
    } catch (error) {
      // Token is invalid, but we don't throw here to allow public procedures
      console.warn('Invalid token:', error);
    }
  }

  return {
    req: opts.req,
    user,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  // Note: superjson transformer removed to avoid ESM/CJS interop issues when running via ts-node.
  // If you need advanced serialization, switch the server to ESM or add a dynamic import pattern.
});

// Authentication middleware
const isAuthenticated = t.middleware(({ next, ctx }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Ensure user is available in protected procedures
    },
  });
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);