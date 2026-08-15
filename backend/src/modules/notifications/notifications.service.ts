import { prisma } from '../../config/prisma';
import { isProd } from '../../config/env';

interface NotifyPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Logs an in-app notification and best-effort sends an FCM push to every
 * registered device for the user. Push failures never block the caller —
 * the in-app notification is always the source of truth. */
export async function notifyUser(userId: string, payload: NotifyPayload) {
  await prisma.notification.create({
    data: { userId, channel: 'IN_APP', title: payload.title, body: payload.body, data: payload.data as never },
  });

  try {
    const tokens = await prisma.deviceToken.findMany({ where: { userId } });
    if (tokens.length > 0) {
      await sendFcmPush(
        tokens.map((t: { token: string }) => t.token),
        payload,
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('FCM push failed (non-fatal):', err);
  }
}

async function sendFcmPush(tokens: string[], payload: NotifyPayload) {
  if (!isProd) {
    // eslint-disable-next-line no-console
    console.log(`[DEV PUSH] -> ${tokens.length} device(s): ${payload.title}`);
    return;
  }
  // Production implementation uses firebase-admin's messaging().sendEachForMulticast.
  // Kept as a thin wrapper here so the FCM SDK is only initialized when actually needed.
  const { getMessaging } = await import('firebase-admin/messaging');
  await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data ? (Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v)])) as never) : undefined,
  });
}

export async function registerDeviceToken(userId: string, token: string, platform: 'android' | 'ios') {
  return prisma.deviceToken.upsert({
    where: { token },
    update: { userId, platform },
    create: { userId, token, platform },
  });
}

export async function listMyNotifications(userId: string) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
}

export async function markRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({ where: { id: notificationId, userId }, data: { readAt: new Date() } });
}
