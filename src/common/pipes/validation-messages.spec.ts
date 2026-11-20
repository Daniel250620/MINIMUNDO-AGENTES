import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  validate,
} from 'class-validator';
import { PaginationDto } from '../dto/pagination.dto';
import { spanishValidationExceptionFactory } from './validation-messages';

class LoginUserDto {
  @IsEmail({}, { message: 'Debes de colocar un correo' })
  email!: string;

  @IsString({ message: 'La contraseña es requerida' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MaxLength(50)
  password!: string;
}

describe('spanishValidationExceptionFactory', () => {
  it('traduce contraseña larga y respeta mensajes personalizados', async () => {
    const dto = Object.assign(new LoginUserDto(), {
      email: 'x',
      password: 'a'.repeat(51),
    });
    const ex = spanishValidationExceptionFactory(await validate(dto));
    const { message } = ex.getResponse() as { message: string[] };
    expect(message).toContain(
      'La contraseña debe tener como máximo 50 caracteres',
    );
    expect(message).toContain('Debes de colocar un correo');
  });

  it('contraseña ausente: un solo aviso de requerida', async () => {
    const dto = plainToInstance(LoginUserDto, { email: 'a@b.com' });
    const ex = spanishValidationExceptionFactory(await validate(dto));
    expect((ex.getResponse() as { message: string[] }).message).toEqual([
      'La contraseña es requerida',
    ]);
  });

  it('limit tiene tope de 100', async () => {
    const dto = plainToInstance(PaginationDto, { limit: '100000' });
    const ex = spanishValidationExceptionFactory(await validate(dto));
    expect((ex.getResponse() as { message: string[] }).message).toContain(
      'El límite debe ser como máximo 100',
    );
  });
});
