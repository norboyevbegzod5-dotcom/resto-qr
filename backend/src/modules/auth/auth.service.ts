import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const admin = await this.prisma.admin.findUnique({ where: { username } });
    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: admin.id, username: admin.username, role: admin.role };
    return {
      accessToken: this.jwtService.sign(payload),
      admin: { id: admin.id, username: admin.username, role: admin.role },
    };
  }

  async createAdmin(username: string, password: string) {
    const hashed = await bcrypt.hash(password, 10);
    return this.prisma.admin.create({
      data: { username, password: hashed },
    });
  }
}
