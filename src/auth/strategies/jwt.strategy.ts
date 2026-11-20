import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';

import { Repository } from 'typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User } from 'src/users/entities/user.entity';

/** Sin secreto propio, cualquiera podría firmar tokens válidos: mejor no arrancar. */
function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET es requerido');
  return secret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      secretOrKey: requireJwtSecret(),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const { id } = payload;

    const user = await this.userRepository.findOne({
      where: { id },
      relations: { rol: true },
    });

    if (!user) throw new UnauthorizedException('Token no valido');

    if (user.rol?.status === false)
      throw new UnauthorizedException(
        'Tu rol de usuario esta desactivado actualmente',
      );

    if (!user.status) throw new UnauthorizedException('Usuario no activo');

    return user;
  }
}
