import type { Request } from 'express';

/**
 * The authenticated identity for a request. Populated by AuthGuard and read
 * everywhere via the @CurrentUser() decorator. `tenantId` is the isolation key
 * — every tenant-scoped DB query must filter by it.
 */
export interface AuthContext {
  tenantId: string;
  userId: string;
  email: string;
  role: string;
}

/** Express request with our auth context attached by AuthGuard. */
export interface AuthedRequest extends Request {
  auth?: AuthContext;
}
