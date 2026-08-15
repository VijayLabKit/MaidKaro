import { env, isProd } from '../../config/env';

/**
 * Thin abstraction over the SMS/OTP provider so swapping MSG91 → Twilio →
 * anything else touches only this file. In development we log the OTP to
 * the console instead of sending a real SMS (no cost, fast local testing).
 */
export async function sendOtpSms(phone: string, otp: string): Promise<void> {
  if (!isProd) {
    // eslint-disable-next-line no-console
    console.log(`[DEV OTP] ${phone} -> ${otp}`);
    return;
  }

  if (env.SMS_PROVIDER === 'MSG91') {
    const url = 'https://control.msg91.com/api/v5/otp';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: env.MSG91_AUTH_KEY ?? '',
      },
      body: JSON.stringify({
        template_id: env.MSG91_OTP_TEMPLATE_ID,
        mobile: phone.replace('+', ''),
        otp,
        sender: env.MSG91_SENDER_ID,
      }),
    });

    if (!res.ok) {
      throw new Error(`SMS provider error: ${res.status} ${await res.text()}`);
    }
    return;
  }

  throw new Error(`Unsupported SMS_PROVIDER: ${env.SMS_PROVIDER}`);
}
