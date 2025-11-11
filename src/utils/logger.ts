// Production-safe logging utility
// Only logs in development, strips sensitive data in production

const isDevelopment = process.env.NODE_ENV === 'development';

// List of sensitive keys to redact
const SENSITIVE_KEYS = [
  'phone',
  'email',
  'password',
  'token',
  'api_key',
  'apikey',
  'secret',
  'credit_card',
  'ssn',
  'transaction_id',
  'payment',
  'authorization',
  'bearer'
];

// Recursively redact sensitive data from objects
function redactSensitiveData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item));
  }

  const redacted: any = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some(sensitiveKey => 
      lowerKey.includes(sensitiveKey)
    );

    if (isSensitive) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

// Safe logger that only works in development
export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      const redactedArgs = args.map(arg => redactSensitiveData(arg));
      console.log(...redactedArgs);
    }
  },

  error: (...args: any[]) => {
    if (isDevelopment) {
      const redactedArgs = args.map(arg => redactSensitiveData(arg));
      console.error(...redactedArgs);
    }
  },

  warn: (...args: any[]) => {
    if (isDevelopment) {
      const redactedArgs = args.map(arg => redactSensitiveData(arg));
      console.warn(...redactedArgs);
    }
  },

  info: (...args: any[]) => {
    if (isDevelopment) {
      const redactedArgs = args.map(arg => redactSensitiveData(arg));
      console.info(...redactedArgs);
    }
  }
};

// Disable console in production
if (!isDevelopment) {
  // Block console methods in production to prevent developer tools misuse
  const noop = () => {};
  window.console.log = noop;
  window.console.error = noop;
  window.console.warn = noop;
  window.console.info = noop;
  window.console.debug = noop;
}

