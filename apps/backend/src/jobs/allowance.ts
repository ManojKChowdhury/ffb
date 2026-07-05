import cron from 'node-cron';
import { query } from '../db';

/**
 * Initializes and schedules the Daily Allowance Engine background job.
 * Runs once every 24 hours (at midnight) to grant +1000 tokens to all active users.
 */
export function startAllowanceJob(logger: any) {
  logger.info('Initializing Daily Allowance Engine background job...');

  // '0 0 * * *' runs at exactly 00:00 every day
  cron.schedule('0 0 * * *', async () => {
    logger.info('[Allowance Job] Triggering daily allowance update...');
    try {
      await query('BEGIN');
      
      await query('UPDATE users SET wallet_balance = wallet_balance + 1000');
      
      await query('COMMIT');
      logger.info('[Allowance Job] Daily allowance of +1000 tokens successfully granted to all users.');
    } catch (err) {
      await query('ROLLBACK');
      logger.error('[Allowance Job] Failed to grant daily allowance:', err);
    }
  });
}
