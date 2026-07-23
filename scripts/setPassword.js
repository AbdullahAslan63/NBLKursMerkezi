import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

const password = process.argv[2];

if (!password) {
  console.error('Lütfen bir şifre belirtin. Örnek: npm run set-password <sifre>');
  process.exit(1);
}

try {
  const saltRounds = 10;
  const hash = await bcrypt.hash(password, saltRounds);

  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const hashKey = 'ADMIN_PASSWORD_HASH';
  const newEntry = `${hashKey}="${hash}"`;

  let lines = envContent.split(/\r?\n/);
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith(hashKey + '=')) {
      lines[i] = newEntry;
      found = true;
      break;
    }
  }

  if (!found) {
    // If the last line is not empty, add an empty line first or just push it
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
      lines.push('');
    }
    lines.push(newEntry);
  }

  // Write back with newlines
  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
  console.log(`Şifre başarıyla hash'lendi ve .env dosyasına ADMIN_PASSWORD_HASH olarak kaydedildi.`);
} catch (error) {
  console.error('Şifre güncellenirken bir hata oluştu:', error);
  process.exit(1);
}
