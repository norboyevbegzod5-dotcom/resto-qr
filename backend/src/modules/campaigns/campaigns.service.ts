import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { vouchers: true } } },
    });
  }

  async findById(id: number) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async getActive() {
    return this.prisma.campaign.findFirst({ where: { isActive: true } });
  }

  async create(dto: CreateCampaignDto) {
    return this.prisma.campaign.create({ data: dto });
  }

  async update(id: number, dto: UpdateCampaignDto) {
    await this.findById(id);
    return this.prisma.campaign.update({ where: { id }, data: dto });
  }

  async delete(id: number) {
    await this.findById(id);
    return this.prisma.campaign.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
