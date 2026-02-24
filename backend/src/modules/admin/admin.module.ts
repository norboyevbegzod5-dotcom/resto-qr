import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { UsersModule } from '../users/users.module';
import { BrandsModule } from '../brands/brands.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { AuthModule } from '../auth/auth.module';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [AuthModule, UsersModule, BrandsModule, CampaignsModule, VouchersModule, BotModule],
  controllers: [AdminController],
})
export class AdminModule {}
