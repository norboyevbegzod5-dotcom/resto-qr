import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Res, ParseIntPipe, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../common/prisma.service';
import { UsersService } from '../users/users.service';
import { BrandsService } from '../brands/brands.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { VouchersService } from '../vouchers/vouchers.service';
import { VoucherGenerationService } from '../vouchers/voucher-generation.service';
import { QrService } from '../vouchers/qr.service';
import { BotService } from '../bot/bot.service';
import { CreateBrandDto } from '../brands/dto/create-brand.dto';
import { CreateCampaignDto } from '../campaigns/dto/create-campaign.dto';
import { UpdateCampaignDto } from '../campaigns/dto/update-campaign.dto';
import { GenerateVouchersDto } from '../vouchers/dto/generate-vouchers.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/admin')
export class AdminController {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private brandsService: BrandsService,
    private campaignsService: CampaignsService,
    private vouchersService: VouchersService,
    private voucherGenerationService: VoucherGenerationService,
    private qrService: QrService,
    private botService: BotService,
  ) {}

  // ── Users ──

  @Get('users')
  async getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('eligible') eligible?: boolean,
    @Query('campaignId') campaignId?: number,
  ) {
    return this.usersService.findAll({ page, limit, search, eligible, campaignId });
  }

  @Get('users/export-csv')
  async exportUsersCsv(@Res() res: Response) {
    const allUsers = await this.usersService.findAll({ page: 1, limit: 100000 });

    const BOM = '\uFEFF';
    const header = 'ID;Имя;Телефон;Chat ID;Кодов;Брендов;Участвует;Дата регистрации';
    const rows = allUsers.data.map((u: any) =>
      [
        u.id,
        u.name || '',
        u.phone || '',
        u.chatId || '',
        u.totalVouchers,
        u.brandCount,
        u.eligible ? 'Да' : 'Нет',
        new Date(u.createdAt).toLocaleDateString('ru-RU'),
      ].join(';'),
    );

    const csv = BOM + [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.send(csv);
  }

  @Post('users/:id/reset-vouchers')
  async resetUserVouchers(@Param('id', ParseIntPipe) id: number) {
    const count = await this.prisma.voucher.updateMany({
      where: { userId: id, status: 'ACTIVATED' },
      data: { status: 'DELETED', activatedAt: null },
    });
    return { ok: true, reset: count.count };
  }

  // ── Brands ──

  @Get('brands')
  async getBrands() {
    return this.brandsService.findAll();
  }

  @Post('brands')
  async createBrand(@Body() dto: CreateBrandDto) {
    return this.brandsService.create(dto.name, dto.slug);
  }

  @Put('brands/:id')
  async updateBrand(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateBrandDto) {
    return this.brandsService.update(id, dto);
  }

  @Delete('brands/:id')
  async deleteBrand(@Param('id', ParseIntPipe) id: number) {
    return this.brandsService.delete(id);
  }

  // ── Campaigns ──

  @Get('campaigns')
  async getCampaigns() {
    return this.campaignsService.findAll();
  }

  @Get('campaigns/:id')
  async getCampaign(@Param('id', ParseIntPipe) id: number) {
    return this.campaignsService.findById(id);
  }

  @Post('campaigns')
  async createCampaign(@Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(dto);
  }

  @Put('campaigns/:id')
  async updateCampaign(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.update(id, dto);
  }

  @Delete('campaigns/:id')
  async deleteCampaign(@Param('id', ParseIntPipe) id: number) {
    return this.campaignsService.delete(id);
  }

  // ── Vouchers ──

  @Get('vouchers')
  async getVouchers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('campaignId') campaignId?: number,
    @Query('brandId') brandId?: number,
    @Query('status') status?: string,
    @Query('code') code?: string,
  ) {
    return this.vouchersService.findAll({ page, limit, campaignId, brandId, status, code });
  }

  @Post('vouchers/generate')
  async generateVouchers(@Body() dto: GenerateVouchersDto) {
    return this.voucherGenerationService.generate(dto.campaignId, dto.brandId, dto.count);
  }

  @Get('vouchers/export')
  async exportVouchers(
    @Query('campaignId') campaignId?: number,
    @Query('brandId') brandId?: number,
    @Res() res?: Response,
  ) {
    const vouchers = await this.vouchersService.exportVouchers(campaignId, brandId);

    const csvRows = [
      'Code,Brand,Campaign,Status,User,ActivatedAt',
      ...vouchers.map((v) =>
        `${v.code},${v.brand.name},${v.campaign.title},${v.status},,${v.activatedAt || ''}`,
      ),
    ];

    res!.setHeader('Content-Type', 'text/csv');
    res!.setHeader('Content-Disposition', 'attachment; filename=vouchers.csv');
    res!.send(csvRows.join('\n'));
  }

  // ── QR Codes ──

  @Get('vouchers/qr/:code')
  async getQrCode(@Param('code') code: string, @Res() res: Response) {
    const png = await this.qrService.generateQrPng(code);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename=qr-${code}.png`);
    res.send(png);
  }

  @Get('vouchers/qr-batch')
  async getQrBatch(
    @Query('campaignId', ParseIntPipe) campaignId: number,
    @Query('brandId') brandId?: number,
    @Query('status') status?: string,
    @Res() res?: Response,
  ) {
    const pdf = await this.qrService.generateBatchPdf(
      campaignId,
      brandId ? +brandId : undefined,
      status,
    );
    res!.setHeader('Content-Type', 'application/pdf');
    res!.setHeader('Content-Disposition', 'attachment; filename=vouchers-qr.pdf');
    res!.send(pdf);
  }

  // ── Lottery ──

  @Post('check-code')
  async checkCode(@Body() body: { code: string }) {
    return this.vouchersService.checkCode(body.code);
  }

  @Post('mark-winner')
  async markWinner(@Body() body: { code: string }) {
    return this.vouchersService.markWinner(body.code);
  }

  // ── Telegram Bots ──

  @Get('bots')
  async getBots() {
    const bots = await this.prisma.telegramBot.findMany({
      include: { brand: true },
      orderBy: { createdAt: 'desc' },
    });
    const running = this.botService.getRunningBots();
    const runningIds = new Set(running.map((r) => r.id));
    return bots.map((b) => ({ ...b, token: undefined, running: runningIds.has(b.id) }));
  }

  @Post('bots')
  async createBot(@Body() body: { name: string; token: string; username: string; brandId?: number; miniAppUrl?: string }) {
    const username = body.username.replace(/^@/, '');

    const existingToken = await this.prisma.telegramBot.findUnique({ where: { token: body.token } });
    if (existingToken) {
      throw new BadRequestException('Бот с таким токеном уже существует');
    }
    const existingUsername = await this.prisma.telegramBot.findUnique({ where: { username } });
    if (existingUsername) {
      throw new BadRequestException('Бот с таким username уже существует');
    }

    const bot = await this.prisma.telegramBot.create({
      data: {
        name: body.name,
        token: body.token,
        username,
        brandId: body.brandId || null,
        miniAppUrl: body.miniAppUrl || null,
      },
    });

    if (bot.isActive) {
      try {
        await this.botService.launchBot(bot);
      } catch (e: any) {
        return { ...bot, launchError: e.message || 'Ошибка запуска бота' };
      }
    }
    return bot;
  }

  @Put('bots/:id')
  async updateBot(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string; token?: string; username?: string; brandId?: number | null; miniAppUrl?: string | null; isActive?: boolean }) {
    const updated = await this.prisma.telegramBot.update({
      where: { id },
      data: body,
    });
    await this.botService.restartBot(id);
    return updated;
  }

  @Delete('bots/:id')
  async deleteBot(@Param('id', ParseIntPipe) id: number) {
    await this.botService.stopBot(id);
    await this.prisma.telegramBot.delete({ where: { id } });
    return { ok: true };
  }

  @Post('bots/:id/restart')
  async restartBot(@Param('id', ParseIntPipe) id: number) {
    await this.botService.restartBot(id);
    return { ok: true };
  }

  @Post('bots/:id/stop')
  async stopBot(@Param('id', ParseIntPipe) id: number) {
    await this.botService.stopBot(id);
    await this.prisma.telegramBot.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }

  // ── Dashboard Stats ──

  @Get('stats')
  async getStats() {
    const [totalUsers, totalVouchers, activatedVouchers, activeCampaigns, totalBrands] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.voucher.count(),
        this.prisma.voucher.count({ where: { status: 'ACTIVATED' } }),
        this.prisma.campaign.count({ where: { isActive: true } }),
        this.prisma.brand.count(),
      ]);

    return { totalUsers, totalVouchers, activatedVouchers, activeCampaigns, totalBrands };
  }
}
