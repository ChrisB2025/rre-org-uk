export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof ContactInput, string>>;
  data?: ContactInput;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 200;
const MAX_MESSAGE = 5000;

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function validateContact(raw: Record<string, unknown>): ValidationResult {
  const errors: Partial<Record<keyof ContactInput, string>> = {};
  const name = asString(raw.name);
  const email = asString(raw.email);
  const message = asString(raw.message);

  if (!name) errors.name = 'Please enter your name.';
  else if (name.length > MAX_NAME) errors.name = 'Name is too long.';

  if (!email) errors.email = 'Please enter your email address.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';

  if (!message) errors.message = 'Please enter a message.';
  else if (message.length > MAX_MESSAGE) errors.message = 'Message is too long.';

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return { valid: true, errors, data: { name, email, message } };
}
