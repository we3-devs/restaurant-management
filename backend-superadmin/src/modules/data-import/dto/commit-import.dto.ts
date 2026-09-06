import { Type } from 'class-transformer';
import { IsArray, IsInt, IsObject, IsString, ValidateNested } from 'class-validator';

/** One row of a commit chunk — see the "commit row payload shape" rule: server owns (clientRowId, rowNumber) from the first commit attempt onward. */
class CommitImportRowDto {
  @IsString()
  clientRowId: string;

  @IsInt()
  rowNumber: number;

  @IsObject()
  values: Record<string, string>;
}

export class CommitImportDto {
  @IsInt()
  jobId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommitImportRowDto)
  rows: CommitImportRowDto[];
}
