import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ConversationModule } from './conversation/conversation.module';
import { FilesModule } from './files/files.module';
import { RolsModule } from './rols/rols.module';
import { UsersModule } from './users/users.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'minimundo',
      autoLoadEntities: true,
      // shortcut: synchronize en lugar de migraciones; cambiar a migraciones antes de tener datos reales.
      synchronize: true,
      dropSchema: process.env.DROP_SCHEMA === 'true',
    }),
    AuthModule,
    UsersModule,
    RolsModule,
    FilesModule,
    WhatsappModule,
    ConversationModule,
  ],
  // Todo requiere JWT salvo lo marcado con @Public() (webhook de Meta, login).
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
