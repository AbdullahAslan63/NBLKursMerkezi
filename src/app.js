import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import { apiResponseMiddleware } from './lib/apiResponse.js';
import { renderPage } from './lib/renderPage.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { seedAdmin } from './lib/seedAdmin.js';
import { createIndexHandler } from './routes/index.js';
import createTeachersRouter from './routes/teachers.js';
import createStudentsRouter from './routes/students.js';
import createClassesRouter from './routes/classes.js';
import createSessionsRouter from './routes/sessions.js';
import createPdfRouter from './routes/pdf.js';
import createCalendarRouter from './routes/calendarApi.js';
import authRouter from './routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createApp(options = {}) {
  const prisma = options.prisma ?? (await import('./lib/prisma.js')).getPrisma();

  await seedAdmin(prisma);

  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-only-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        name: 'nobelkurs.sid',
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
      },
    }),
  );

  app.use(apiResponseMiddleware);

  app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
  });

  app.locals.appName = 'Nobel Kurs Merkezi';

  app.use(requireAuth);

  app.get('/', createIndexHandler(prisma));
  app.use('/teachers', createTeachersRouter(prisma));
  app.use('/students', createStudentsRouter(prisma));
  app.use('/api/classes', createClassesRouter(prisma));
  app.use('/api/sessions', createSessionsRouter(prisma));
  app.use('/api/calendar', createCalendarRouter(prisma));
  app.use('/pdf', createPdfRouter(prisma));
  app.use('/', authRouter);

  app.use((req, res, next) => {
    const acceptsJson =
      req.headers.accept?.includes('application/json') || req.path.startsWith('/api/');

    if (acceptsJson) {
      return res.fail('NOT_FOUND', 'İstenen kaynak bulunamadı.', { status: 404 });
    }

    return renderPage(res, 'pages/not-found', { title: 'Sayfa Bulunamadı', activeNav: null }).catch(next);
  });

  app.use(errorHandler);

  return app;
}
