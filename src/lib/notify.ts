import { prisma } from "./prisma";
import type { NotificationChannel, NotificationType } from "./enums";

export type NotificationPayload = {
  subject: string;
  body: string;
  deepLink: string;
};

/**
 * Pluggable send adapter. Default is a console/DB-log adapter so the
 * platform runs with zero external infra. Swap `activeAdapter` (or wire
 * env-based selection) for a real ESP (SES/SendGrid) or SMS gateway
 * (Twilio/MSG91) in production — the call sites never change.
 */
export interface NotificationAdapter {
  send(channel: NotificationChannel, to: string, payload: NotificationPayload): Promise<{ ok: boolean; error?: string }>;
}

class ConsoleLogAdapter implements NotificationAdapter {
  async send(channel: NotificationChannel, to: string, payload: NotificationPayload) {
    console.log(`[notify:${channel}] -> ${to} :: ${payload.subject} :: ${payload.deepLink}`);
    return { ok: true };
  }
}

export const activeAdapter: NotificationAdapter = new ConsoleLogAdapter();

export async function queueAndSendNotification(params: {
  tenantId: string;
  type: NotificationType;
  channel: NotificationChannel;
  policyVersionId?: string;
  recipientUserId?: string;
  recipientVendorUserId?: string;
  to: string;
  payload: NotificationPayload;
}) {
  const record = await prisma.notification.create({
    data: {
      tenantId: params.tenantId,
      type: params.type,
      channel: params.channel,
      policyVersionId: params.policyVersionId,
      recipientUserId: params.recipientUserId,
      recipientVendorUserId: params.recipientVendorUserId,
      status: "QUEUED",
      payload: JSON.stringify(params.payload),
    },
  });

  const result = await activeAdapter.send(params.channel, params.to, params.payload);

  await prisma.notification.update({
    where: { id: record.id },
    data: {
      status: result.ok ? "SENT" : "FAILED",
      error: result.error,
      sentAt: result.ok ? new Date() : null,
    },
  });

  return record.id;
}
