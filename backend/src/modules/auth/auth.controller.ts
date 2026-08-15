import { Request, Response } from 'express';
import { asyncHandler } from '../../common/middleware/errorHandler';
import * as authService from './auth.service';

export const requestOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.requestOtp(req.body);
  res.status(200).json({ data: result, message: 'OTP sent' });
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.verifyOtp(req.body);
  res.status(200).json({ data: result });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refreshAccessToken(req.body.refreshToken);
  res.status(200).json({ data: result });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.body.refreshToken);
  res.status(200).json({ message: 'Logged out' });
});

export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.adminLogin(email, password);
  res.status(200).json({ data: result });
});
