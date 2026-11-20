import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { spanishValidationExceptionFactory } from './common/pipes/validation-messages';
import { QueryFailedFilter } from './common/filters/query-failed.filter';
import { InvalidJsonFilter } from './common/filters/invalid-json.filter';

async function bootstrap() {
  // rawBody: la firma de Meta (X-Hub-Signature-256) se calcula sobre los bytes exactos recibidos.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  const httpAdapter = app.get(HttpAdapterHost).httpAdapter;
  app.useGlobalFilters(
    new QueryFailedFilter(httpAdapter),
    new InvalidJsonFilter(httpAdapter),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      exceptionFactory: spanishValidationExceptionFactory,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
