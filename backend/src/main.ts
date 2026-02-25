import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3001'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Resto QR API')
    .setDescription('Restaurant voucher lottery system API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/api/health', (_req: any, res: any) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  const clientPath = join(__dirname, '..', 'client');
  if (existsSync(clientPath)) {
    app.useStaticAssets(clientPath);

    expressApp.get(/^(?!\/api\/).*/, (_req: any, res: any) => {
      res.sendFile(join(clientPath, 'index.html'));
    });
  }

  const port = process.env.PORT || 10000;
  console.log(`Attempting to listen on port ${port}...`);
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on port ${port}`);
  console.log(`Swagger docs at /api/docs`);

  if (process.env.RENDER_EXTERNAL_URL) {
    const url = process.env.RENDER_EXTERNAL_URL;
    setInterval(() => {
      fetch(`${url}/api/health`).catch(() => {});
    }, 14 * 60 * 1000);
    console.log(`Keep-alive ping enabled for ${url}`);
  }
}
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
