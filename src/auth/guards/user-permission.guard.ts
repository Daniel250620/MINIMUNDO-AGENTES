import { Reflector } from '@nestjs/core';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { Observable } from 'rxjs';
import { User } from 'src/users/entities/user.entity';
import { META_PERMISSIONS } from '../decorators/permission-protected.decorator';

@Injectable()
export class UserPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const validPermissions: string[] = this.reflector.get(
      META_PERMISSIONS,
      context.getHandler(),
    );

    if (!validPermissions) return true;
    if (validPermissions.length === 0) return true;

    const user = context.switchToHttp().getRequest<{ user?: User }>().user;
    if (!user) throw new BadRequestException('Usuario no encontrado');

    if (user.rol?.name === 'Administrador') return true;

    const hasPermission = validPermissions.some((validPermission) =>
      user.rol?.permissions?.includes(validPermission),
    );

    if (hasPermission) return true;

    throw new ForbiddenException(
      `User: ${user.name} no tiene los permisos necesarios`,
    );
  }
}
