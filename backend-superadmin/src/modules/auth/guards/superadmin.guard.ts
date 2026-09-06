import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../types/authenticated-request';

/** Gates superadmin-granting endpoints — only an existing superadmin may create or demote another one, independent of the ordinary permission system (which isSuperadmin itself bypasses). */
@Injectable()
export class SuperadminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.isSuperadmin) {
      throw new ForbiddenException('Only a superadmin can perform this action');
    }
    return true;
  }
}
