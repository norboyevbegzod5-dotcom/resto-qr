import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class VouchersService {
  private readonly logger = new Logger(VouchersService.name);

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  async activateCode(chatId: string, code: string, name?: string, phone?: string) {
    const user = await this.usersService.findOrCreateByChatId(chatId, name, phone);

    const voucher = await this.prisma.voucher.findUnique({
      where: { code },
      include: { campaign: true, brand: true },
    });

    if (!voucher) {
      await this.logActivation(chatId, code, false, 'INVALID_CODE');
      throw new BadRequestException({ error: 'INVALID_CODE', message: 'Код не найден' });
    }

    if (voucher.status !== 'FREE') {
      await this.logActivation(chatId, code, false, 'ALREADY_ACTIVATED');
      throw new BadRequestException({ error: 'ALREADY_ACTIVATED', message: 'Код уже активирован' });
    }

    if (!voucher.campaign.isActive) {
      await this.logActivation(chatId, code, false, 'CAMPAIGN_INACTIVE');
      throw new BadRequestException({ error: 'CAMPAIGN_INACTIVE', message: 'Акция завершена' });
    }

    const now = new Date();
    if (now < voucher.campaign.startDate || now > voucher.campaign.endDate) {
      await this.logActivation(chatId, code, false, 'CAMPAIGN_EXPIRED');
      throw new BadRequestException({ error: 'CAMPAIGN_EXPIRED', message: 'Акция не активна в данный момент' });
    }

    await this.prisma.voucher.update({
      where: { id: voucher.id },
      data: {
        userId: user.id,
        status: 'ACTIVATED',
        activatedAt: now,
      },
    });

    await this.logActivation(chatId, code, true);

    const stats = await this.usersService.getUserStats(chatId);

    return {
      ok: true,
      code,
      totalVouchers: stats!.totalVouchers,
      brandCount: stats!.brandCount,
      brands: stats!.brands,
      eligible: stats!.eligible,
    };
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    campaignId?: number;
    brandId?: number;
    status?: string;
    code?: string;
  }) {
    const { page = 1, limit = 20, campaignId, brandId, status, code } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (campaignId) where.campaignId = campaignId;
    if (brandId) where.brandId = brandId;
    if (status) where.status = status;
    if (code) where.code = { contains: code, mode: 'insensitive' };

    const [vouchers, total] = await Promise.all([
      this.prisma.voucher.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          brand: true,
          campaign: true,
          user: { select: { id: true, name: true, phone: true } },
        },
      }),
      this.prisma.voucher.count({ where }),
    ]);

    return { data: vouchers, total, page, limit };
  }

  async checkCode(code: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { code },
      include: {
        brand: true,
        campaign: true,
        user: true,
      },
    });

    if (!voucher) {
      return { found: false };
    }

    let stats: { totalVouchers: number; brandCount: number; eligible: boolean } | null = null;
    if (voucher.user) {
      const userStats = await this.usersService.getUserStats(voucher.user.chatId!);
      if (userStats) {
        stats = {
          totalVouchers: userStats.totalVouchers,
          brandCount: userStats.brandCount,
          eligible: userStats.eligible,
        };
      }
    }

    return {
      found: true,
      voucher: {
        code: voucher.code,
        status: voucher.status,
        brand: voucher.brand.name,
        campaign: voucher.campaign.title,
        activatedAt: voucher.activatedAt,
      },
      user: voucher.user
        ? {
            id: voucher.user.id,
            name: voucher.user.name,
            phone: voucher.user.phone,
            chatId: voucher.user.chatId,
          }
        : null,
      stats,
    };
  }

  async markWinner(code: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { code },
      include: { user: true },
    });

    if (!voucher) {
      throw new BadRequestException('Voucher not found');
    }

    if (voucher.status !== 'ACTIVATED') {
      throw new BadRequestException('Voucher must be in ACTIVATED status');
    }

    await this.prisma.$transaction([
      this.prisma.voucher.update({
        where: { id: voucher.id },
        data: { status: 'USED' },
      }),
      this.prisma.winner.create({
        data: { voucherId: voucher.id },
      }),
    ]);

    return { ok: true, code, userId: voucher.userId };
  }

  async exportVouchers(campaignId?: number, brandId?: number) {
    const where: any = {};
    if (campaignId) where.campaignId = campaignId;
    if (brandId) where.brandId = brandId;

    return this.prisma.voucher.findMany({
      where,
      include: { brand: true, campaign: true },
      orderBy: { code: 'asc' },
    });
  }

  private async logActivation(chatId: string | null, code: string, success: boolean, reason?: string) {
    try {
      await this.prisma.activationLog.create({
        data: { chatId, code, success, reason },
      });
    } catch (e) {
      this.logger.error('Failed to log activation', e);
    }
  }
}
