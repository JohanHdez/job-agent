import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { ApiError } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

const CV_DIR = process.env['CV_DIR'] ?? path.resolve('./cv');

/** Multer storage — saves uploaded CV to the cv/ directory */
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await fs.mkdir(CV_DIR, { recursive: true });
    cb(null, CV_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `cv${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  },
});

export const cvRouter = Router();

/**
 * GET /api/cv
 * Returns information about the currently uploaded CV.
 */
cvRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const files = await fs.readdir(CV_DIR);
    const cvFiles = files.filter((f) => /\.(pdf|docx)$/i.test(f));

    if (cvFiles.length === 0) {
      res.json({ hasCV: false, message: 'No CV found. Please upload a PDF or DOCX file.' });
      return;
    }

    const cvFile = cvFiles[0]!;
    const stat = await fs.stat(path.join(CV_DIR, cvFile));

    res.json({
      hasCV: true,
      fileName: cvFile,
      sizeBytes: stat.size,
      uploadedAt: stat.mtime.toISOString(),
    });
  } catch {
    res.json({ hasCV: false });
  }
});

/**
 * POST /api/cv/upload
 * Accepts a PDF or DOCX file upload and saves it to cv/.
 */
cvRouter.post('/upload', upload.single('cv'), (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded');
  }

  logger.info(`CV uploaded: ${req.file.originalname} → ${req.file.path}`);
  res.json({
    success: true,
    message: 'CV uploaded successfully',
    fileName: req.file.filename,
    sizeBytes: req.file.size,
  });
});

/**
 * DELETE /api/cv
 * Removes the current CV file.
 */
cvRouter.delete('/', async (_req: Request, res: Response) => {
  const files = await fs.readdir(CV_DIR).catch(() => [] as string[]);
  const cvFiles = files.filter((f) => /\.(pdf|docx)$/i.test(f));

  for (const file of cvFiles) {
    await fs.unlink(path.join(CV_DIR, file));
    logger.info(`Deleted CV file: ${file}`);
  }

  res.json({ success: true, message: `Deleted ${cvFiles.length} CV file(s)` });
});
