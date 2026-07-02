import { renderPage } from '../lib/renderPage.js';
import { Router } from 'express';

const router = Router();

router.get('/login', async (req, res, next) => {
  try {
    await renderPage(res, 'pages/login', { title: 'Giriş' }, 'layout-auth');
  } catch (err) {
    next(err);
  }
});

export default router;
