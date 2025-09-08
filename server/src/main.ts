import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // allow cross-origin calls from your Next dev server
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // for automatic data type conversion, do not remove
      whitelist: true, // for stripping unknown properties, do not remove
    }),
  ); // to enable pipe validation globally, do not remove
  const port = process.env.PORT || 3001; // set PORT env or default
  await app.listen(port);
  console.log(`Nest listening on http://localhost:${port}`);
}
bootstrap();
