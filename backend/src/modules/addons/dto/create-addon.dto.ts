import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAddonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  addonGroupId?: number;

  @ApiProperty({ example: 'Extra cheese' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number = 0;

  @ApiPropertyOptional({
    default: false,
    description:
      'Gates whether Orders resolves addon_recipes and reserves ingredient stock for this addon.',
  })
  @IsOptional()
  @IsBoolean()
  isRecipeEnabled?: boolean = false;
}
