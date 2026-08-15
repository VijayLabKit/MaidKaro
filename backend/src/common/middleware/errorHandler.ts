import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { isProd } from '../../config/env';

// Duck-typed guard instead of `instanceof Prisma.PrismaClientKnownRequestError`
// so this file doesn't hard-depend on the generated Prisma namespace shape.
function isPrismaKnownRequestError(err: unknown): err is { code: string; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string' &&
    (err as { name?: unknown }).name === 'PrismaClientKnownRequestError'
  );
}

// Wrap async route handlers so thrown/rejected errors reach the error middleware
// instead of crashing the process or hanging the request.
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(
  fn: T,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.flatten() },
    });
  }

  if (isPrismaKnownRequestError(err)) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: { code: 'DUPLICATE_RECORD', message: 'A record with these details already exists' },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found' } });
    }
  }

  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
      ...(isProd ? {} : { stack: err instanceof Error ? err.stack : String(err) }),
    },
  });
}
