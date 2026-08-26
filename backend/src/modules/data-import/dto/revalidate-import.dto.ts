import { Type } from 'class-transformer';
import { IsArray, IsInt, IsObject, ValidateNested } from 'class-validator';

class RevalidateImportRowDto {
  @IsInt()
  rowNumber: number;

  @IsObject()
  values: Record<string, string>;
}

export class RevalidateImportDto {
  @IsInt()
  jobId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RevalidateImportRowDto)
  rows: RevalidateImportRowDto[];
}
