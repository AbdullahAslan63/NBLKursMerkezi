import multer from 'multer';
import path from 'path';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.xls', '.xlsx']);

export const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      const err = new Error('Yalnızca .xls veya .xlsx dosyaları kabul edilir.');
      err.code = 'VALIDATION_ERROR';
      return cb(err);
    }
    cb(null, true);
  },
});
