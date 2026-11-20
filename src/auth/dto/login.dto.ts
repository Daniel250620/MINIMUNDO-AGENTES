import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Debes de colocar un correo' })
  email!: string;

  @IsString({ message: 'La contraseña es requerida' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MaxLength(50)
  password!: string;
}
