import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthContext, AuthedRequest } from './auth-context';

/**
 * Injects the authenticated AuthContext into a controller handler.
 * Usage: `handler(@CurrentUser() user: AuthContext)`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!request.auth) {
      // AuthGuard runs first and guarantees this; defensive for safety.
      throw new Error('AuthContext missing — is AuthGuard applied?');
    }
    return request.auth;
  },
);
