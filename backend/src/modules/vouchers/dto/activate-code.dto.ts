import { IsString, IsOptional } from 'class-validator';

export class ActivateCodeDto {
  @IsString()
  chatId: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
