const crypto = require('crypto');
async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey(
    'raw',
    encoded,
    { name: 'PBKDF2', hash: 'SHA-256' },
    false,
  );
  const bits = await crypto.subtle.deriveBits(
    'PBKDF2',
    key,
    { name: 'PBKDF2', hash: 'SHA-256', salt: crypto.getRandomValues(new Uint8Array(16)), iterations: 100000 },
    new Uint8Array(32),
  );
  return Buffer.from(bits).toString('hex');
}
(async () => {
  try {
    const hash = await hashPassword('Admin@12345');
    console.log(hash);
  } catch (err) {
    console.error('Hash error:', err.message);
  }
})();
