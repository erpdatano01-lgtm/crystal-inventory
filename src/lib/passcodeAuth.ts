export const AUTH_COOKIE_NAME = 'vivida_auth';

function getPasscodeSecret(): string {
  return process.env.SITE_PASSCODE || '0654182699';
}

function getSigningSecret(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'vivida-crystal-passcode-signing-key-2026'
  );
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function checkPasscode(input: string): boolean {
  return input.trim() === getPasscodeSecret();
}

export async function createAuthToken(): Promise<string> {
  const payload = `vivida:${getPasscodeSecret()}`;
  return hmacHex(payload, getSigningSecret());
}

export async function verifyAuthToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await createAuthToken();
  return token === expected;
}
