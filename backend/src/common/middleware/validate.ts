import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validates and replaces req[target] with the parsed (and type-coerced) data.
 * Throws (via next) a ZodError on failure, caught by the global error handler.
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[target]);
      (req as unknown as Record<string, unknown>)[target] = parsed;
      next();
    } catch (err) {
      next(err);
    }
  };
}
