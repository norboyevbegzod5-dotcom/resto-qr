import { IsString, IsOptional, IsDateString, IsInt, IsBoolean, Min } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sumPerVoucher?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minVouchers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minBrands?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
