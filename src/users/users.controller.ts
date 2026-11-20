import { uuidPipe } from 'src/common/pipes/uuid.pipe';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthPermissions } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from './entities/user.entity';
import { PaginationUserDto } from './dto/paginate-user.dto';

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('/save')
  @AuthPermissions('Users:write')
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get('/paginate')
  findAll(@Query() paginationDto: PaginationUserDto) {
    return this.usersService.findAll(paginationDto);
  }

  // @Get('/find-with-folio')
  // findWithFolio() {
  //   return this.usersService.findWithFolio();
  // }

  @Get(':id')
  @AuthPermissions('Users:read')
  findOne(@Param('id', uuidPipe) id: string, @GetUser() user: User) {
    return this.usersService.findOne(id, user);
  }

  @Patch(':id')
  @AuthPermissions('Users:write')
  update(
    @Param('id', uuidPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser() user: User,
  ) {
    return this.usersService.update(id, updateUserDto, user);
  }

  @Delete(':id')
  @AuthPermissions('Users:write')
  remove(@Param('id', uuidPipe) id: string) {
    return this.usersService.remove(id);
  }
}
