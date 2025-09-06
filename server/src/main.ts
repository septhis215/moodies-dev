import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // allow cross-origin calls from your Next dev server
  const port = process.env.PORT || 3001; // set PORT env or default
  await app.listen(port);
  console.log(`Nest listening on http://localhost:${port}`);
}
bootstrap();
