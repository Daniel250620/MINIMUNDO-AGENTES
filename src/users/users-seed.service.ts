import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Rol } from 'src/rols/entities/rol.entity';

@Injectable()
export class UsersSeedService implements OnModuleInit {
  private readonly logger = new Logger(UsersSeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
  ) {}

  /** Crea el admin inicial desde SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD; sin ellas no crea nada. */
  async onModuleInit() {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) return;
    const hashedPassword = bcrypt.hashSync(password, 10);

    for (const seed of [{ email, rolName: 'Administrador' }]) {
      const exists = await this.userRepository.findOne({
        where: { email: seed.email },
      });

      if (exists) continue;

      const rol = await this.rolRepository.findOne({
        where: { name: seed.rolName },
      });

      if (!rol) {
        this.logger.warn(
          `Rol ${seed.rolName} no encontrado; no se pudo crear el usuario seed ${seed.email}`,
        );
        continue;
      }

      const user = this.userRepository.create({
        email: seed.email,
        password: hashedPassword,
        status: true,
        rol,
      });
      await this.userRepository.save(user);
      this.logger.log(`Usuario seed creado: ${seed.email}`);
    }
  }
}
