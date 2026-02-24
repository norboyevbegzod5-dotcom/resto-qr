import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class VoucherGenerationService {
  constructor(private prisma: PrismaService) {}

  private generateCode(length = 7): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private async generateUniqueCode(): Promise<string> {
    let code: string;
    let exists = true;
    while (exists) {
      code = this.generateCode();
      const found = await this.prisma.voucher.findUnique({ where: { code: code! } });
      exists = !!found;
    }
    return code!;
  }

  async generate(campaignId: number, brandId: number, count: number) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');

    const vouchers: { code: string; brandName: string; campaignTitle: string }[] = [];

    for (let i = 0; i < count; i++) {
      const code = await this.generateUniqueCode();
      await this.prisma.voucher.create({
        data: {
          code,
          campaignId,
          brandId,
          status: 'FREE',
        },
      });
      vouchers.push({
        code,
        brandName: brand.name,
        campaignTitle: campaign.title,
      });
    }

    return vouchers;
  }
}
