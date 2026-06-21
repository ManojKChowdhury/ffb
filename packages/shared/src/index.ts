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
  predictedOutcome: z.enum(['HOME_WIN', 'AWAY_WIN', 'DRAW'], {
    errorMap: () => ({ message: 'Predicted outcome must be HOME_WIN, AWAY_WIN, or DRAW' })
  })
});

export type PredictionSubmissionInput = z.infer<typeof PredictionSubmissionSchema>;
