import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';

export async function createTicket(userId: string, subject: string, message: string) {
  return prisma.supportTicket.create({
    data: { raisedById: userId, subject, message, messages: { create: { senderId: userId, body: message } } },
  });
}

export async function listMyTickets(userId: string) {
  return prisma.supportTicket.findMany({
    where: { raisedById: userId },
    orderBy: { createdAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
}

export async function getTicket(userId: string, ticketId: string, isAdmin: boolean) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!ticket) throw AppError.notFound('Ticket not found');
  if (!isAdmin && ticket.raisedById !== userId) throw AppError.forbidden();
  return ticket;
}

export async function addMessage(userId: string, ticketId: string, body: string, isAdmin: boolean) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw AppError.notFound('Ticket not found');
  if (!isAdmin && ticket.raisedById !== userId) throw AppError.forbidden();

  return prisma.supportMessage.create({ data: { ticketId, senderId: userId, body } });
}

export async function raiseComplaint(userId: string, role: 'CUSTOMER' | 'WORKER', bookingId: string, description: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { customer: true, worker: true } });
  if (!booking) throw AppError.notFound('Booking not found');

  const isParty =
    (role === 'CUSTOMER' && booking.customer.userId === userId) || (role === 'WORKER' && booking.worker?.userId === userId);
  if (!isParty) throw AppError.forbidden();

  return prisma.complaint.create({
    data: { bookingId, raisedBy: role, raisedByUserId: userId, description },
  });
}
