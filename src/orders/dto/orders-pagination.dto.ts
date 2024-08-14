import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common';
import { OrderStatusList } from '../enum/enum';
import { OrderStatus } from '@prisma/client';

export class OrdersPaginationDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OrderStatusList, { message: `Possible values: ${OrderStatusList}` })
  status: OrderStatus;
}
