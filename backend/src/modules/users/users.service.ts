import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';

export async function getMyProfile(userId: string) {
  const profile = await prisma.customerProfile.findUnique({ where: { userId }, include: { addresses: { include: { pincode: true } } } });
  if (!profile) throw AppError.notFound('Customer profile not found');
  return profile;
}

export async function updateMyProfile(userId: string, data: Record<string, unknown>) {
  await prisma.customerProfile.findUniqueOrThrow({ where: { userId } });
  return prisma.customerProfile.update({ where: { userId }, data });
}

export async function listAddresses(userId: string) {
  const profile = await prisma.customerProfile.findUniqueOrThrow({ where: { userId } });
  return prisma.customerAddress.findMany({ where: { customerId: profile.id }, orderBy: { isDefault: 'desc' } });
}

export async function addAddress(
  userId: string,
  input: { label: string; line1: string; line2?: string; pincode: string; latitude: number; longitude: number; isDefault?: boolean },
) {
  const profile = await prisma.customerProfile.findUniqueOrThrow({ where: { userId } });

  const pincode = await prisma.pincode.findUnique({ where: { code: input.pincode } });
  if (!pincode) throw AppError.badRequest('MaidKaro is not yet available in this area');

  if (input.isDefault) {
    await prisma.customerAddress.updateMany({ where: { customerId: profile.id }, data: { isDefault: false } });
  }

  return prisma.customerAddress.create({
    data: {
      customerId: profile.id,
      label: input.label,
      line1: input.line1,
      line2: input.line2,
      pincodeId: pincode.id,
      latitude: input.latitude,
      longitude: input.longitude,
      isDefault: input.isDefault ?? false,
    },
  });
}

export async function updateAddress(userId: string, addressId: string, data: Record<string, unknown>) {
  const profile = await prisma.customerProfile.findUniqueOrThrow({ where: { userId } });
  const address = await prisma.customerAddress.findUnique({ where: { id: addressId } });
  if (!address || address.customerId !== profile.id) throw AppError.notFound('Address not found');

  if (data.isDefault === true) {
    await prisma.customerAddress.updateMany({ where: { customerId: profile.id }, data: { isDefault: false } });
  }

  return prisma.customerAddress.update({ where: { id: addressId }, data: data as never });
}

export async function deleteAddress(userId: string, addressId: string) {
  const profile = await prisma.customerProfile.findUniqueOrThrow({ where: { userId } });
  const address = await prisma.customerAddress.findUnique({ where: { id: addressId } });
  if (!address || address.customerId !== profile.id) throw AppError.notFound('Address not found');
  await prisma.customerAddress.delete({ where: { id: addressId } });
}
