import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class PaginationUserDto extends PaginationDto {
  @IsString()
  @IsOptional()
  rol?: string = 'Todos';

  @IsString()
  @IsOptional()
  estatus?: string = 'Todos';
}
