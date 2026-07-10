import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { BotService } from '../bot/bot.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private botService: BotService,
  ) {}

  @Cron('0 12 * * *')
  async dailyReminders() {
    this.logger.log('Running daily reminder cron job...');

    const campaign = await this.prisma.campaign.findFirst({
      where: { isActive: true },
    });
    if (!campaign) return;

    const users = await this.prisma.user.findMany({
      where: { chatId: { not: null } },
      include: {
        vouchers: {
          where: { status: 'ACTIVATED', campaignId: campaign.id },
          include: { brand: true },
        },
      },
    });

    let sent = 0;
    for (const user of users) {
      const total = user.vouchers.length;
      if (total === 0) continue;

      const brandIds = new Set(user.vouchers.map((v) => v.brandId));
      const brandCount = brandIds.size;

      const remainingVouchers = campaign.minVouchers - total;
      const remainingBrands = campaign.minBrands - brandCount;

      if (remainingVouchers <= 0 && remainingBrands <= 0) continue;
      if (remainingVouchers > 5) continue;

      const lang = user.botLanguage || 'RU';
      let msg: string;

      if (lang === 'UZ') {
        const parts: string[] = [];
        if (remainingVouchers > 0) parts.push(`${remainingVouchers} ta kupon`);
        if (remainingBrands > 0) parts.push(`${remainingBrands} ta brend`);
        msg = `🔔 Eslatma!\n\nSizda ${total} ta kupon bor.\nO'yinda ishtirok etish uchun yana ${parts.join(' va ')} kerak.\n\n🎁 "${campaign.title}" aksiyasi davom etmoqda!`;
      } else {
        const parts: string[] = [];
        if (remainingVouchers > 0) parts.push(`${remainingVouchers} купон(ов)`);
        if (remainingBrands > 0) parts.push(`${remainingBrands} бренд(ов)`);
        msg = `🔔 Напоминание!\n\nУ вас ${total} купон(ов).\nДо участия в розыгрыше осталось: ${parts.join(' и ')}.\n\n🎁 Акция "${campaign.title}" продолжается!`;
      }

      const ok = await this.botService.sendMessageToUser(user.chatId!, msg);
      if (ok) sent++;

      await new Promise((r) => setTimeout(r, 35));
    }

    this.logger.log(`Daily reminders sent: ${sent}`);
  }

  async getTargetUsers(filters: {
    minVouchers?: number;
    maxRemaining?: number;
    eligible?: boolean;
    botId?: number;
  }) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { isActive: true },
    });
    if (!campaign) return [];

    let brandId: number | null = null;
    if (filters.botId) {
      const bot = await this.prisma.telegramBot.findUnique({
        where: { id: filters.botId },
      });
      if (!bot) return [];
      brandId = bot.brandId;
    }

    const users = await this.prisma.user.findMany({
      where: {
        chatId: { not: null },
        ...(brandId
          ? {
              vouchers: {
                some: {
                  status: 'ACTIVATED',
                  campaignId: campaign.id,
                  brandId,
                },
              },
            }
          : {}),
      },
      include: {
        vouchers: {
          where: { status: 'ACTIVATED', campaignId: campaign.id },
          include: { brand: true },
        },
      },
    });

    return users
      .map((user) => {
        const total = user.vouchers.length;
        const brandIds = new Set(user.vouchers.map((v) => v.brandId));
        const brandCount = brandIds.size;
        const remainingVouchers = Math.max(0, campaign.minVouchers - total);
        const remainingBrands = Math.max(0, campaign.minBrands - brandCount);
        const isEligible = remainingVouchers === 0 && remainingBrands === 0;
        const brandVouchers = brandId
          ? user.vouchers.filter((v) => v.brandId === brandId).length
          : total;

        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          chatId: user.chatId!,
          lang: user.botLanguage || 'RU',
          totalVouchers: total,
          brandVouchers,
          brandCount,
          remainingVouchers,
          remainingBrands,
          eligible: isEligible,
        };
      })
      .filter((u) => {
        if (u.totalVouchers === 0) return false;
        if (filters.eligible === true) return u.eligible;
        if (filters.eligible === false) return !u.eligible;
        if (filters.minVouchers !== undefined && u.totalVouchers < filters.minVouchers) return false;
        if (filters.maxRemaining !== undefined && u.remainingVouchers > filters.maxRemaining) return false;
        return true;
      });
  }

  async sendBroadcast(
    chatIds: string[],
    message: string,
    botId?: number,
  ): Promise<{ sent: number; failed: number }> {
    return this.botService.broadcastToUsers(chatIds, message, botId);
  }
}
