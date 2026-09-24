// goHR SMS provider abstraction. Chosen via env:
//   SMS_PROVIDER=console (default) | twilio | webhook
//   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM  (twilio)
//   SMS_WEBHOOK_URL   (webhook: POST {to, text} JSON)
// The console provider logs to stdout so dev flows work out of the box.

export function smsProvider() {
  return process.env.SMS_PROVIDER || 'console';
}

export async function sendSms(to, text) {
  const provider = smsProvider();
  try {
    if (provider === 'twilio') {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM;
      if (!sid || !token || !from) {return { ok: false, provider, reason: 'twilio_env_missing' };}
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ To: to, From: from, Body: text }),
        signal: AbortSignal.timeout(8000)
      });
      return { ok: res.ok, provider };
    }
    if (provider === 'webhook') {
      const url = process.env.SMS_WEBHOOK_URL;
      if (!url) {return { ok: false, provider, reason: 'webhook_env_missing' };}
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to, text }),
        signal: AbortSignal.timeout(8000)
      });
      return { ok: res.ok, provider };
    }
    console.log(`[sms] to ${to}: ${text}`);
    return { ok: true, provider: 'console' };
  } catch (e) {
    return { ok: false, provider, reason: String(e && e.message || e).slice(0, 120) };
  }
}
