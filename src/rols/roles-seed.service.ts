import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rol } from './entities/rol.entity';

const SEED_ROLES: Array<Pick<Rol, 'name' | 'description' | 'permissions'>> = [
  {
    name: 'Administrador',
    description: 'Acceso total al sistema.',
    permissions: [],
  },
  {
    name: 'View All',
    description: 'Acceso de solo lectura a todo el sistema.',
    permissions: ['Users:read'],
  },
];

@Injectable()
export class RolesSeedService implements OnModuleInit {
  private readonly logger = new Logger(RolesSeedService.name);

  constructor(
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
  ) {}

  async onModuleInit() {
    for (const seed of SEED_ROLES) {
      const exists = await this.rolRepository.findOne({
        where: { name: seed.name },
      });

      if (exists) continue;

      const rol = this.rolRepository.create({ ...seed, status: true });
      await this.rolRepository.save(rol);
      this.logger.log(`Rol seed creado: ${seed.name}`);
    }
  }
}
