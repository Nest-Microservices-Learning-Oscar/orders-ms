import { IsNumber, IsPositive } from 'class-validator';

export class OrderItemDto {
  @IsPositive()
  @IsNumber()
  productId: number;

  @IsPositive()
  @IsNumber()
  quantity: number;

  @IsPositive()
  @IsNumber()
  price: number;
}
