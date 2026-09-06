import { IsInt } from 'class-validator';

export class MoveIngredientDto {
  @IsInt()
  outletId: number;
}
