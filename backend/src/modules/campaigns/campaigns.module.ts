import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';

@Module({
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
