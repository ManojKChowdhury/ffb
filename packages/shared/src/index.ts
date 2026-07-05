import { z } from 'zod';

export const RegistrationSchema = z.object({
  username: z
    .string()
    .min(3, { message: 'Username must be at least 3 characters long' })
    .max(20, { message: 'Username must be at most 20 characters long' })
    .regex(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain alphanumeric characters and underscores' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters long' })
});

export type RegistrationInput = z.infer<typeof RegistrationSchema>;

export const LoginSchema = z.object({
  username: z.string().min(1, { message: 'Username is required' }),
  password: z.string().min(1, { message: 'Password is required' })
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const PredictionSubmissionSchema = z.object({
  matchId: z.string().min(1, { message: 'Match ID is required' }),
  predictedHomeScore: z.number().int().min(0, { message: 'Home score must be a non-negative integer' }),
  predictedAwayScore: z.number().int().min(0, { message: 'Away score must be a non-negative integer' })
});

export type PredictionSubmissionInput = z.infer<typeof PredictionSubmissionSchema>;

export const BetSubmissionSchema = z.object({
  matchId: z.string().min(1, { message: 'Match ID is required' }),
  predictedHomeScore: z.number().int().min(0, { message: 'Home score must be a non-negative integer' }),
  predictedAwayScore: z.number().int().min(0, { message: 'Away score must be a non-negative integer' }),
  betAmount: z.number().int().positive({ message: 'Bet amount must be a positive integer greater than zero' })
});

export type BetSubmissionInput = z.infer<typeof BetSubmissionSchema>;
