import type { ExecutionContext } from '@nestjs/common';
import type { User } from 'src/users/entities/user.entity';
import {
  createParamDecorator,
  InternalServerErrorException,
} from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: User }>();
    const user = req.user;

    if (!user)
      throw new InternalServerErrorException('Usuario no encontrado (request)');

    return !data ? user : (user as unknown as Record<string, unknown>)[data];
  },
);
