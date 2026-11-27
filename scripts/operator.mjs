import { randomBytes, scryptSync } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';

const [, , username, operation] = process.argv;
if (!username || !/^[a-z0-9][a-z0-9._-]{1,63}$/.test(username) || !['add', 'remove'].includes(operation)) {
  throw new Error('Usage: node scripts/operator.mjs USERNAME add|remove');
}
const file = process.env.OPERATORS_FILE;
if (!file) throw new Error('Set OPERATORS_FILE to a private writable path');
let users = {};
try {
  users = JSON.parse(await readFile(file, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (operation === 'add') {
  const password = randomBytes(24).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  users[username] = salt + ':' + scryptSync(password, salt, 64).toString('hex');
  await save();
  console.log(password);
} else {
  delete users[username];
  await save();
}

async function save() {
  const temp = file + '.' + randomBytes(8).toString('hex');
  await writeFile(temp, JSON.stringify(users), { mode: 0o600, flag: 'wx' });
  await rename(temp, file);
}
