// Twilio integration for WhatsApp OTP via Replit connector
import twilio from 'twilio';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.account_sid || !connectionSettings.settings.api_key || !connectionSettings.settings.api_key_secret)) {
    throw new Error('Twilio not connected');
  }
  return {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number
  };
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  return twilio(apiKey, apiKeySecret, {
    accountSid: accountSid
  });
}

export async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

export async function sendWhatsAppOtp(toPhone: string, otp: string): Promise<boolean> {
  try {
    const client = await getTwilioClient();
    const fromPhone = await getTwilioFromPhoneNumber();

    const normalizedTo = toPhone.startsWith('+') ? toPhone : `+${toPhone}`;

    const message = await client.messages.create({
      body: `Your RecycleLah! verification code is: ${otp}. This code expires in 10 minutes. Do not share this code with anyone.`,
      from: `whatsapp:${fromPhone}`,
      to: `whatsapp:${normalizedTo}`
    });

    console.log(`[Twilio] WhatsApp OTP sent to ${normalizedTo}, SID: ${message.sid}`);
    return true;
  } catch (error: any) {
    console.error(`[Twilio] Failed to send WhatsApp OTP:`, error.message);
    return false;
  }
}

export async function sendSmsOtp(toPhone: string, otp: string): Promise<boolean> {
  try {
    const client = await getTwilioClient();
    const fromPhone = await getTwilioFromPhoneNumber();

    const normalizedTo = toPhone.startsWith('+') ? toPhone : `+${toPhone}`;

    const message = await client.messages.create({
      body: `Your RecycleLah! verification code is: ${otp}. This code expires in 10 minutes.`,
      from: fromPhone,
      to: normalizedTo
    });

    console.log(`[Twilio] SMS OTP sent to ${normalizedTo}, SID: ${message.sid}`);
    return true;
  } catch (error: any) {
    console.error(`[Twilio] Failed to send SMS OTP:`, error.message);
    return false;
  }
}
