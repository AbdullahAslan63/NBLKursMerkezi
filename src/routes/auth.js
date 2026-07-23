import { renderPage } from '../lib/renderPage.js';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { getPrisma } from '../lib/prisma.js';
import { redirectIfAuthenticated } from '../middleware/auth.js';

const router = Router();

router.get('/login', redirectIfAuthenticated, async (req, res, next) => {
  try {
    await renderPage(res, 'pages/login', { title: 'Giriş' }, 'layout-auth');
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.fail('VALIDATION_ERROR', 'Kullanıcı adı ve şifre zorunludur.', { status: 400 });
  }

  try {
    const prisma = getPrisma();
    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      return res.fail('VALIDATION_ERROR', 'Hatalı kullanıcı adı veya şifre.', { status: 400 });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.fail('VALIDATION_ERROR', 'Hatalı kullanıcı adı veya şifre.', { status: 400 });
    }

    req.session.authenticated = true;
    req.session.adminId = admin.id;

    return res.success({ message: 'Giriş başarılı' });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ ok: false, error: { message: 'Çıkış yapılamadı' } });
    }
    res.clearCookie('nobelkurs.sid');
    res.redirect('/login');
  });
});

export default router;
