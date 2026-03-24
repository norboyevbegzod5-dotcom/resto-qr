import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOrCreateByChatId(chatId: string, name?: string, phone?: string) {
    let user = await this.prisma.user.findUnique({ where: { chatId } });

    if (!user) {
      user = await this.prisma.user.create({
        data: { chatId, name, phone },
      });
    } else {
      const updates: any = {};
      if (name && !user.name) updates.name = name;
      if (phone && !user.phone) updates.phone = phone;
      if (Object.keys(updates).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updates,
        });
      }
    }

    return user;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    eligible?: boolean;
    campaignId?: number;
  }) {
    const { page = 1, limit = 20, search, eligible, campaignId } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const voucherWhere = campaignId ? { campaignId, status: 'ACTIVATED' as const } : { status: 'ACTIVATED' as const };

    const activeCampaign = campaignId
      ? await this.prisma.campaign.findUnique({ where: { id: campaignId } })
      : await this.prisma.campaign.findFirst({ where: { isActive: true } });

    const enrich = (user: any) => {
      const totalVouchers = user.vouchers.length;
      const brandCount = new Set(user.vouchers.map((v: any) => v.brandId)).size;
      const isEligible = activeCampaign
        ? totalVouchers >= activeCampaign.minVouchers && brandCount >= activeCampaign.minBrands
        : false;
      return {
        id: user.id, name: user.name, phone: user.phone, chatId: user.chatId,
        botLanguage: user.botLanguage, createdAt: user.createdAt,
        totalVouchers, brandCount, eligible: isEligible,
      };
    };

    if (eligible !== undefined) {
      const allUsers = await this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { vouchers: { where: voucherWhere, include: { brand: true } } },
      });
      const allEnriched = allUsers.map(enrich).filter((u) => u.eligible === eligible);
      const total = allEnriched.length;
      const data = allEnriched.slice(skip, skip + limit);
      return { data, total, page, limit };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { vouchers: { where: voucherWhere, include: { brand: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users.map(enrich), total, page, limit };
  }

  async countEligible(): Promise<number> {
    const activeCampaign = await this.prisma.campaign.findFirst({ where: { isActive: true } });
    if (!activeCampaign) return 0;

    const users = await this.prisma.user.findMany({
      include: {
        vouchers: {
          where: { status: 'ACTIVATED', campaignId: activeCampaign.id },
          select: { brandId: true },
        },
      },
    });

    return users.filter((u) => {
      const brandCount = new Set(u.vouchers.map((v) => v.brandId)).size;
      return u.vouchers.length >= activeCampaign.minVouchers && brandCount >= activeCampaign.minBrands;
    }).length;
  }

  async getUserStats(chatId: string) {
    const user = await this.prisma.user.findUnique({
      where: { chatId },
      include: {
        vouchers: {
          where: { status: 'ACTIVATED' },
          include: { brand: true, campaign: true },
        },
      },
    });

    if (!user) return null;

    const activeCampaign = await this.prisma.campaign.findFirst({
      where: { isActive: true },
    });

    const campaignVouchers = activeCampaign
      ? user.vouchers.filter((v) => v.campaignId === activeCampaign.id)
      : user.vouchers;

    const brandMap = new Map<string, number>();
    for (const v of campaignVouchers) {
      const current = brandMap.get(v.brand.name) || 0;
      brandMap.set(v.brand.name, current + 1);
    }

    const brands = Array.from(brandMap.entries()).map(([brand, count]) => ({
      brand,
      count,
    }));

    const totalVouchers = campaignVouchers.length;
    const brandCount = brands.length;
    const eligible = activeCampaign
      ? totalVouchers >= activeCampaign.minVouchers && brandCount >= activeCampaign.minBrands
      : false;

    return { user, totalVouchers, brands, brandCount, eligible, campaign: activeCampaign };
  }

  async updateBotStep(chatId: string, botStep: string) {
    return this.prisma.user.update({
      where: { chatId },
      data: { botStep },
    });
  }

  async updateLanguage(chatId: string, botLanguage: string) {
    return this.prisma.user.update({
      where: { chatId },
      data: { botLanguage },
    });
  }

  async updatePhone(chatId: string, phone: string) {
    return this.prisma.user.update({
      where: { chatId },
      data: { phone },
    });
  }

  async updatePendingVoucherCode(chatId: string, code: string) {
    return this.prisma.user.update({
      where: { chatId },
      data: { pendingVoucherCode: code },
    });
  }

  async clearPendingVoucherCode(chatId: string) {
    return this.prisma.user.update({
      where: { chatId },
      data: { pendingVoucherCode: null },
    });
  }
}
