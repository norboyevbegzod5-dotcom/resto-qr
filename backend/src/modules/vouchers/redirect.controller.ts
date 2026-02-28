import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../common/prisma.service';

@Controller('v')
export class RedirectController {
  constructor(private prisma: PrismaService) {}

  @Get(':code')
  async redirect(@Param('code') code: string, @Res() res: Response) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { code },
    });

    let botUsername = 'resto_bot';

    if (voucher) {
      const bot = await this.prisma.telegramBot.findFirst({
        where: { brandId: voucher.brandId, isActive: true },
      });
      if (bot) {
        botUsername = bot.username;
      } else {
        const anyBot = await this.prisma.telegramBot.findFirst({
          where: { isActive: true },
        });
        if (anyBot) botUsername = anyBot.username;
      }
    }

    const telegramUrl = `https://t.me/${botUsername}?start=CODE_${code}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="1;url=${telegramUrl}">
  <title>Купон ${code}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 20px; }
    .card { background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 20px; padding: 40px 30px; max-width: 360px; width: 100%; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    .code { font-size: 32px; font-weight: 800; letter-spacing: 3px; margin: 12px 0; }
    .text { font-size: 16px; opacity: 0.9; margin-bottom: 20px; }
    .btn { display: inline-block; background: white; color: #667eea; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 12px; text-decoration: none; transition: transform 0.2s; }
    .btn:hover { transform: scale(1.05); }
    .loader { margin-top: 16px; opacity: 0.7; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🎟</div>
    <div class="text">Ваш купон</div>
    <div class="code">${code}</div>
    <a href="${telegramUrl}" class="btn">Открыть в Telegram</a>
    <div class="loader">Перенаправляем автоматически...</div>
  </div>
</body>
</html>`);
  }
}
