import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { AppConfig } from '../../../config/configuration';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService<AppConfig>,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const authenticated = await super.canActivate(context);
    if (!authenticated) return false;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const mode = this.configService.get('app', { infer: true })!.mode;
    const isSuperadmin = request.user?.isSuperadmin === true;

    if (mode === 'superadmin' && !isSuperadmin) {
      throw new ForbiddenException('Only superadmins may access this API');
    }
    if (mode === 'normal' && isSuperadmin) {
      throw new ForbiddenException('Superadmins must use the superadmin API');
    }
    return true;
  }
}
