import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Rol } from 'src/rols/entities/rol.entity';
import { File } from 'src/files/entities/file.entity';
import { RolsModule } from 'src/rols/rols.module';
import { AuthModule } from 'src/auth/auth.module';
import { FilesModule } from 'src/files/files.module';
import { UsersSeedService } from './users-seed.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersSeedService],
  imports: [
    TypeOrmModule.forFeature([User, Rol, File]),
    RolsModule,
    FilesModule,
    forwardRef(() => AuthModule),
  ],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
