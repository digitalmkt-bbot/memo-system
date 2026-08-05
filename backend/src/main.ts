import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  // Disable Nest's built-in body parser so ours (with a larger limit) is the only
  // one registered — otherwise the default 100kb JSON parser runs first and
  // rejects inline base64 images before our middleware is reached.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableCors({ origin: true, credentials: true });
  // Allow base64 image payloads (e.g. announcement images).
  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ extended: true, limit: '15mb' }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`MEMO API listening on http://localhost:${port}`);
}
bootstrap();
