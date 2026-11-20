import { Module, forwardRef } from '@nestjs/common';
import { RolsService } from './rols.service';
import { RolsController } from './rols.controller';
import { Rol } from './entities/rol.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { RolesSeedService } from './roles-seed.service';

@Module({
  controllers: [RolsController],
  providers: [RolsService, RolesSeedService],
  imports: [TypeOrmModule.forFeature([Rol]), forwardRef(() => AuthModule)],
  exports: [RolsService, TypeOrmModule],
})
export class RolsModule {}
