import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(query?: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = query ?? {};
    const skip = (page - 1) * limit;

    const where = status ? { status: status as any } : {};

    const [orders, total] = await Promise.all([
      this.prisma.paymentOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, username: true } },
          package: { select: { id: true, name: true, price: true } },
        },
      }),
      this.prisma.paymentOrder.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: orders.map(o => ({
        id: o.id.toString(),
        orderNo: o.orderNo,
        userId: o.userId.toString(),
        userEmail: o.user.email,
        username: o.user.username,
        packageId: o.packageId?.toString() ?? null,
        packageName: o.package?.name ?? '自定义积分',
        packagePrice: o.package ? Number(o.package.price) : null,
        credits: (o as any).credits ?? null,
        orderType: (o as any).orderType ?? 'package',
        amount: o.amount,
        status: o.status,
        payType: o.payType,
        transactionId: o.transactionId,
        expireAt: o.expireAt,
        paidAt: o.paidAt,
        createdAt: o.createdAt,
      })),
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
    };
  }

  async stats() {
    const [total, paid, pending, expired, totalRevenue] = await Promise.all([
      this.prisma.paymentOrder.count(),
      this.prisma.paymentOrder.count({ where: { status: 'paid' } }),
      this.prisma.paymentOrder.count({ where: { status: 'pending' } }),
      this.prisma.paymentOrder.count({ where: { status: 'expired' } }),
      this.prisma.paymentOrder.aggregate({
        where: { status: 'paid' },
        _sum: { amount: true },
      }),
    ]);

    return {
      total,
      paid,
      pending,
      expired,
      totalRevenueFen: totalRevenue._sum.amount ?? 0,
      totalRevenueYuan: ((totalRevenue._sum.amount ?? 0) / 100).toFixed(2),
    };
  }
}
