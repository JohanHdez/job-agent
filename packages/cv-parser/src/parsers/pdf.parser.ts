import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import type { RawCvData } from '@job-agent/core';
import { logger } from '../utils/logger';

/**
 * Reads a PDF file from disk and extracts raw text content.
 * @param filePath - Absolute or relative path to the PDF file.
 * @returns RawCvData with the extracted text and metadata.
 */
export async function parsePdf(filePath: string): Promise<RawCvData> {
  const absolutePath = path.resolve(filePath);
  logger.info(`Parsing PDF: ${absolutePath}`);

  const buffer = await fs.readFile(absolutePath);
  const parsed = await pdfParse(buffer);

  logger.info(`PDF parsed successfully. Pages: ${parsed.numpages}`);

  return {
    filePath: absolutePath,
    text: parsed.text,
    pageCount: parsed.numpages,
    extractedAt: new Date().toISOString(),
  };
}

/**
 * Reads a DOCX file from disk and extracts raw text content.
 * @param filePath - Absolute or relative path to the DOCX file.
 * @returns RawCvData with the extracted text and metadata.
 */
export async function parseDocx(filePath: string): Promise<RawCvData> {
  const absolutePath = path.resolve(filePath);
  logger.info(`Parsing DOCX: ${absolutePath}`);

  const result = await mammoth.extractRawText({ path: absolutePath });

  if (result.messages.length > 0) {
    result.messages.forEach((msg) => logger.warn(`DOCX parse warning: ${msg.message}`));
  }

  return {
    filePath: absolutePath,
    text: result.value,
    pageCount: 1, // DOCX does not expose page count easily
    extractedAt: new Date().toISOString(),
  };
}

/**
 * Automatically detects the file type and parses a CV file.
 * Supports PDF and DOCX formats.
 * @param filePath - Path to the CV file.
 * @returns RawCvData extracted from the file.
 */
export async function parseCV(filePath: string): Promise<RawCvData> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    return parsePdf(filePath);
  } else if (ext === '.docx') {
    return parseDocx(filePath);
  } else {
    throw new Error(`Unsupported file format: ${ext}. Only PDF and DOCX are supported.`);
  }
}
