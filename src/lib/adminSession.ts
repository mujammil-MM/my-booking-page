const encoder = new TextEncoder();
const decoder = new TextDecoder();
const FALLBACK_SECRET = 'fallback-secret-at-least-32-chars-long';

type AdminSessionPayload = {
  email: string;
  role: 'admin';
  exp: number;
};

function getSecret(): string {
  return process.env.JWT_SECRET || FALLBACK_SECRET;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function encodeSegment(value: unknown): string {
  return toBase64Url(encoder.encode(JSON.stringify(value)));
}

function decodeSegment<T>(segment: string): T {
  return JSON.parse(decoder.decode(fromBase64Url(segment))) as T;
}

async function importSigningKey() {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signValue(value: string): Promise<string> {
  const key = await importSigningKey();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

async function verifyValue(value: string, signature: string): Promise<boolean> {
  const key = await importSigningKey();

  return crypto.subtle.verify('HMAC', key, fromBase64Url(signature), encoder.encode(value));
}

export async function createAdminSession(email: string): Promise<string> {
  const header = encodeSegment({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeSegment({
    email,
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  } satisfies AdminSessionPayload);
  const unsignedToken = `${header}.${payload}`;
  const signature = await signValue(unsignedToken);

  return `${unsignedToken}.${signature}`;
}

export async function verifyAdminSession(token: string): Promise<AdminSessionPayload> {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [header, payload, signature] = parts;
  const isValid = await verifyValue(`${header}.${payload}`, signature);

  if (!isValid) {
    throw new Error('Invalid token signature');
  }

  const parsedPayload = decodeSegment<AdminSessionPayload>(payload);

  if (!parsedPayload.exp || parsedPayload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  if (parsedPayload.role !== 'admin' || !parsedPayload.email) {
    throw new Error('Invalid token payload');
  }

  return parsedPayload;
}
