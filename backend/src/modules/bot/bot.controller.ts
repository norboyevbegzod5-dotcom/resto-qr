import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { VouchersService } from '../vouchers/vouchers.service';
import { UsersService } from '../users/users.service';
import { ActivateCodeDto } from '../vouchers/dto/activate-code.dto';

@ApiTags('Bot')
@Controller('api/bot')
export class BotController {
  constructor(
    private vouchersService: VouchersService,
    private usersService: UsersService,
  ) {}

  @Post('activate-code')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async activateCode(@Body() dto: ActivateCodeDto) {
    return this.vouchersService.activateCode(dto.chatId, dto.code, dto.name, dto.phone);
  }

  @Get('status')
  async getStatus(@Query('chatId') chatId: string) {
    const stats = await this.usersService.getUserStats(chatId);
    if (!stats) {
      return { totalVouchers: 0, brands: [], eligible: false };
    }
    return {
      totalVouchers: stats.totalVouchers,
      brands: stats.brands,
      brandCount: stats.brandCount,
      eligible: stats.eligible,
    };
  }
}
