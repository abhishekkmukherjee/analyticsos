import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthContext, AuthedRequest } from './auth-context';
import { IS_PUBLIC_KEY } from './public.decorator';

const DEV_AUTH_ID = 'dev-user';

/**
 * STUB authentication. Two modes:
 *
 *  - Header mode: reads `x-tenant-id` / `x-user-id` / `x-user-email` from the
 *    request. This is the seam Clerk plugs into later — swap this guard for a
 *    Clerk token verifier and keep the same AuthContext shape downstream.
 *
 *  - Dev fallback (non-production only): if no headers are present, a single
 *    demo tenant + user is auto-provisioned so every endpoint is usable
 *    immediately with zero setup.
 *
 * In production with no credentials → 401.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    request.auth = await this.resolveAuth(request);
    return true;
  }

  private async resolveAuth(request: AuthedRequest): Promise<AuthContext> {
    const tenantId = header(request, 'x-tenant-id');
    const userId = header(request, 'x-user-id');
    const email = header(request, 'x-user-email');
    const role = header(request, 'x-user-role') ?? 'member';

    if (tenantId && userId) {
      return { tenantId, userId, email: email ?? 'unknown@local', role };
    }

    const isProduction = this.config.get('NODE_ENV') === 'production';
    if (isProduction) {
      throw new UnauthorizedException('Missing authentication headers');
    }

    return this.ensureDemoIdentity();
  }

  /** Idempotently create (or fetch) the local demo tenant + user. */
  private async ensureDemoIdentity(): Promise<AuthContext> {
    const existing = await this.prisma.user.findUnique({
      where: { authId: DEV_AUTH_ID },
    });
    if (existing) {
      return {
        tenantId: existing.tenantId,
        userId: existing.id,
        email: existing.email,
        role: existing.role,
      };
    }

    const tenant = await this.prisma.tenant.create({
      data: { name: 'Demo Tenant', plan: 'starter' },
    });
    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'demo@analyticsos.local',
        name: 'Demo User',
        role: 'owner',
        authId: DEV_AUTH_ID,
      },
    });
    return {
      tenantId: tenant.id,
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }
}

function header(request: AuthedRequest, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
