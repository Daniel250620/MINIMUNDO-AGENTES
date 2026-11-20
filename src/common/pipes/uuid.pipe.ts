import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

export const uuidPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Proporciona un UUID valido'),
});
