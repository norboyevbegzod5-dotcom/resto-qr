import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
  }

  async findById(id: number) {
    return this.prisma.brand.findUnique({ where: { id } });
  }

  async create(name: string, slug: string) {
    const existing = await this.prisma.brand.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('Brand with this slug already exists');

    return this.prisma.brand.create({ data: { name, slug } });
  }

  async update(id: number, data: { name?: string; slug?: string }) {
    return this.prisma.brand.update({ where: { id }, data });
  }

  async delete(id: number) {
    return this.prisma.brand.delete({ where: { id } });
  }
}
