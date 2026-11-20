import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, Not } from 'typeorm';
import { isUUID } from 'class-validator';
import * as bcrypt from 'bcrypt';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { Rol } from 'src/rols/entities/rol.entity';
import { File } from 'src/files/entities/file.entity';
import { v4 as uuid } from 'uuid';
import { FilesService } from 'src/files/files.service';
import { PaginationUserDto } from './dto/paginate-user.dto';
import { applyListQuery } from 'src/common/list-query.util';
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,

    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,

    private readonly fileService: FilesService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { rolId, avatar, ...data } = createUserDto;

    if (!data.password) data.password = uuid();

    const userEmail = await this.findOneByEmail(data.email);

    if (userEmail)
      throw new BadRequestException({
        message: `Ya existe un usuario con ese correo`,
      });

    const rol = await this.rolRepository.findOneBy({ id: rolId });

    if (!rol) throw new NotFoundException(`Rol con id ${rolId} no encontrado`);

    let file: File | null = null;
    if (avatar) {
      file = await this.fileRepository.findOneBy({ id: avatar });
      if (!file)
        throw new NotFoundException(`Archivo con id ${avatar} no encontrado`);
    }

    data.password = bcrypt.hashSync(data.password, 10);
    const user = this.userRepository.create({
      ...data,
      rol,
      avatar: file,
    });
    await this.userRepository.save(user);

    delete (user as Partial<User>).password;

    return user;
  }

  async findAll(paginationDto: PaginationUserDto) {
    const { rol = 'Todos', estatus = 'Todos' } = paginationDto;

    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.avatar', 'avatar')
      .leftJoinAndSelect('user.rol', 'rol');

    if (estatus !== 'Todos') {
      if (estatus === 'Activos') {
        query.andWhere('user.status = :status', { status: true });
      }
      if (estatus === 'Inactivos') {
        query.andWhere('user.status = :status', { status: false });
      }
    }

    if (rol !== 'Todos') {
      const roles = rol.split(',');
      query.andWhere('UPPER(rol.name) IN (:...roles)', {
        roles: roles.map((role) => role.toUpperCase()),
      });
    }

    applyListQuery(query, paginationDto, {
      alias: 'user',
      search: [
        'user.name',
        'user.lastName',
        'user.secondLastName',
        'user.email',
        // 'user.phone',
      ],
      // phoneFields: ['user.phone'],
      sort: {
        name: 'user.name',
        lastName: 'user.lastName',
        email: 'user.email',
        // phone: 'user.phone',
        'rol.name': 'rol.name',
      },
    });

    const [data, total] = await query.getManyAndCount();

    data.forEach((u) => delete (u as Partial<User>).password);

    // const records = await Promise.all(
    //   data.map(async (user) => {
    //     const image = await this.fileService.findOne(user.avatar.id);

    //     user.avatar = image;

    //     return { ...user, avatar: image };
    //   }),
    // );

    return {
      records: data,
      total: total,
    };
  }

  async findOne(id: string, user: User) {
    if (!isUUID(id))
      throw new BadRequestException('Proporciona un UUID valido');

    const userFound = await this.userRepository.findOne({
      where: { id },
      relations: {
        avatar: true,
        rol: true,
      },
    });

    if (!userFound) throw new NotFoundException('Usuario no encontrado');

    if (userFound.avatar?.id) {
      const image = await this.fileService.findOne(userFound.avatar.id);
      userFound.avatar = image;
    }

    if (user.rol?.name === 'Administrador') return userFound;

    if (userFound.id === user.id) return userFound;

    throw new ForbiddenException(
      `Usuario: ${user.name} no tiene los permisos necesarios`,
    );
  }

  async update(id: string, updateUserDto: UpdateUserDto, user: User) {
    const { avatar, rolId, ...data } = updateUserDto;
    const userFound = Object.assign(await this.findOne(id, user), data);

    if (updateUserDto.password) {
      const newPassword = updateUserDto.password;
      delete updateUserDto.password;
      userFound.password = bcrypt.hashSync(newPassword, 10);
    }

    if (rolId) {
      if (!isUUID(updateUserDto.rolId))
        throw new BadRequestException('Proporciona un UUID valido');

      const rol = await this.rolRepository.findOneBy({
        id: updateUserDto.rolId,
      });

      if (!rol)
        throw new NotFoundException(
          `Rol con id ${updateUserDto.rolId} no encontrado`,
        );

      userFound.rol = rol;
    }

    if (avatar) {
      const file = await this.fileRepository.findOneBy({
        id: updateUserDto.avatar,
      });
      if (!file)
        throw new NotFoundException(
          `Archivo con id ${updateUserDto.avatar} no encontrado`,
        );
      userFound.avatar = file;
    }

    if (data.email) {
      const emailOwner = await this.findOneByEmail(data.email);
      if (emailOwner && emailOwner.id !== id)
        throw new BadRequestException('Ya existe un usuario con ese correo');
    }

    // Mismo normalizado que @BeforeUpdate: repository.update() no dispara hooks de la entidad.
    userFound.updateData();

    const { affected } = await this.userRepository.update({ id }, userFound);

    return { message: `Usuario actualizado` };
  }

  async remove(id: string) {
    const { affected } = await this.userRepository.delete({ id });
    if (affected === 0)
      throw new BadRequestException(`Usuario con id ${id} no encontrado`);

    return { message: 'Usuario eliminado' };
  }

  async findOneByEmail(email: string) {
    const user = await this.userRepository.findOneBy({
      email: email.toLowerCase().trim(),
    });

    return user;
  }

  // async findWithFolio() {
  //   const users = await this.userRepository.find({
  //     where: {
  //       folio: Not(IsNull()),
  //     },
  //   });

  //   return users;
  // }
}
