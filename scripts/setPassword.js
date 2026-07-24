import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { getPrisma, resetPrisma } from '../src/lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

const password = process.argv[2];
const username = process.argv[3] || 'admin';

if (!password) {
  console.error('Lütfen bir şifre belirtin. Örnek: npm run set-password <sifre> [kullaniciAdi]');
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
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
      lines.push('');
    }
    lines.push(newEntry);
  }

  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
  console.log(`Şifre hash'i .env dosyasına ${hashKey} olarak kaydedildi.`);

  process.env.ADMIN_PASSWORD_HASH = hash;
  const prisma = getPrisma();
  await prisma.admin.upsert({
    where: { username },
    create: { username, password: hash },
    update: { password: hash },
  });
  console.log(`Veritabanında "${username}" kullanıcısının şifresi güncellendi.`);
  await prisma.$disconnect();
  resetPrisma();
} catch (error) {
  console.error('Şifre güncellenirken bir hata oluştu:', error);
  process.exit(1);
}
