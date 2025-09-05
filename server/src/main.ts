import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    transform: true, // for automatic data type conversion, do not remove
    whitelist: true, // for stripping unknown properties, do not remove
  })); // to enable pipe validation globally, do not remove
  await app.listen(process.env.PORT ?? 3333);
}
bootstrap();
