import {
  HttpCode,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaClient } from '@prisma/client';
import { UUID } from 'crypto';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrdersPaginationDto } from './dto/orders-pagination.dto';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';
import { NATS_SERVICE, PRODUCT_SERVICE } from 'src/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {
    super();
  }
  private readonly logger = new Logger('OrdersService');

  onModuleInit() {
    this.$connect();
    this.logger.log('Database connected');
  }
  async create(createOrderDto: CreateOrderDto) {
    try {
      const { items } = createOrderDto;
      const productIds = items.map((item) => item.productId);

      const products = await firstValueFrom(
        this.client.send({ cmd: 'validate_products' }, productIds),
      );

      const totalAmount = items.reduce((acc, item) => {
        const price = products.find((p) => p.id === item.productId).price;
        return acc + price * item.quantity;
      }, 0);

      const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);

      const data = items.map((item) => ({
        price: products.find((p) => p.id === item.productId).price,
        productId: item.productId,
        quantity: item.quantity,
      }));

      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: { createMany: { data } },
        },
        include: {
          OrderItem: {
            select: { price: true, productId: true, quantity: true },
          },
        },
      });

      return {
        ...order,
        OrderItem: order.OrderItem.map((item) => ({
          ...item,
          name: products.find((p) => p.id === item.productId).name,
        })),
      };
    } catch (e) {
      throw new RpcException({
        code: HttpStatus.BAD_REQUEST,
        message: 'Invalid product ids',
      });
    }
  }

  async findAll(ordersPaginationDto: OrdersPaginationDto) {
    const { status, limit, page } = ordersPaginationDto;

    const totalPages = await this.order.count({ where: { status } });
    const lastPage = Math.ceil(totalPages / limit);

    return {
      data: await this.order.findMany({
        skip: (page - 1) * limit,
        take: limit,
        where: { status },
      }),
      meta: {
        total: totalPages,
        page: page,
        lastPage: lastPage,
      },
    };
  }

  async findOne(id: string) {
    try {
      const order = await this.order.findFirst({
        where: { id },
        include: {
          OrderItem: {
            select: { productId: true, quantity: true, price: true },
          },
        },
      });

      if (!order) {
        throw new RpcException({
          code: HttpStatus.NOT_FOUND,
          message: `Order with id ${id} not found`,
        });
      }

      const producIds = order.OrderItem.map((item) => item.productId);

      const products = await firstValueFrom(
        this.client.send({ cmd: 'validate_products' }, producIds),
      );

      order.OrderItem = order.OrderItem.map((item) => ({
        ...item,
        name: products.find((p) => p.id === item.productId).name,
      }));

      return order;
    } catch (e) {
      throw new RpcException({
        code: HttpStatus.BAD_REQUEST,
        message: e.message,
      });
    }
  }

  async changeOrderStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;

    const order = await this.findOne(id);

    if (order.status === status) return order;

    return this.order.update({
      where: { id },
      data: { status },
    });
  }
}
