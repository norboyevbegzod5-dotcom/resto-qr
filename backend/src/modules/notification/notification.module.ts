import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PrismaService } from '../../common/prisma.service';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [BotModule],
  providers: [NotificationService, PrismaService],
  exports: [NotificationService],
})
export class NotificationModule {}
