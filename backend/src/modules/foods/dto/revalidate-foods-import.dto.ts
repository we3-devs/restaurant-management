import { ArrayMinSize, IsArray, IsObject } from 'class-validator';

/**
 * Loosely-typed on purpose: rows come back from the frontend as the same raw
 * string-keyed shape the file parser produces (name/slug/sku/basePrice/...),
 * after the user hand-edits values in the preview table. FoodsImportService
 * re-runs the exact same field validation used at upload time.
 */
export class RevalidateFoodsImportDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsObject({ each: true })
  rows: Record<string, string>[];
}
