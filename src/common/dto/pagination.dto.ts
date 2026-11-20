import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  IsString,
  Min,
} from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  order?: string = 'asc';

  @IsOptional()
  @IsString()
  search?: string = '';

  @IsOptional()
  @IsString()
  status?: string = 'All';
}
