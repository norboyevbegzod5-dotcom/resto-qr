import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotController } from './bot.controller';
import { VouchersModule } from '../vouchers/vouchers.module';
import { UsersModule } from '../users/users.module';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [VouchersModule, UsersModule, CampaignsModule],
  providers: [BotService],
  controllers: [BotController],
  exports: [BotService],
})
export class BotModule {}
