import { IsInt, Min, Max } from 'class-validator';

export class GenerateVouchersDto {
  @IsInt()
  campaignId: number;

  @IsInt()
  brandId: number;

  @IsInt()
  @Min(1)
  @Max(10000)
  count: number;
}
