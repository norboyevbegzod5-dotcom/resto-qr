import { Module } from '@nestjs/common';
import { BrandsService } from './brands.service';

@Module({
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
