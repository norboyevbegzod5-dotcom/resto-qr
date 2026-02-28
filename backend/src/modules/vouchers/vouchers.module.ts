import { Module } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { VoucherGenerationService } from './voucher-generation.service';
import { QrService } from './qr.service';
import { RedirectController } from './redirect.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [RedirectController],
  providers: [VouchersService, VoucherGenerationService, QrService],
  exports: [VouchersService, VoucherGenerationService, QrService],
})
export class VouchersModule {}
