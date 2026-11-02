require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { pool } = require('../config/db');
const { uploadsDir } = require('../config/localStorage');
const { logger } = require('../utils/logger');

/**
 * Delete uploaded files of finished print jobs. The print job records are kept
 * for tracking and reports; only their file_path is cleared.
 * @param {number} daysOld - Number of days to keep files after a job is finished
 */
async function cleanupOldFiles(daysOld = 7) {
  const result = await pool.query(
    `SELECT id, file_path
     FROM print_jobs
     WHERE status IN ('completed', 'delivered', 'cancelled')
       AND file_path IS NOT NULL
       AND updated_at < CURRENT_TIMESTAMP - make_interval(days => $1)`,
    [daysOld]
  );

  logger.info(`Found ${result.rows.length} print jobs with files to clean up`);

  let filesDeleted = 0;
  let errors = 0;

  for (const job of result.rows) {
    try {
      try {
        await fs.unlink(path.join(uploadsDir, path.basename(job.file_path)));
        filesDeleted++;
      } catch (error) {
        if (error.code !== 'ENOENT') { // Ignore if file doesn't exist
          throw error;
        }
        logger.warn(`File not found: ${job.file_path}`);
      }

      await pool.query('UPDATE print_jobs SET file_path = NULL WHERE id = $1', [job.id]);
    } catch (error) {
      errors++;
      logger.error(`Error cleaning up print job ${job.id}:`, error);
      // Continue with next job even if one fails
    }
  }

  logger.info(`Cleanup completed: ${filesDeleted} files deleted, ${errors} errors`);

  return {
    totalProcessed: result.rows.length,
    filesDeleted,
    errors
  };
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  const days = process.argv[2] ? parseInt(process.argv[2], 10) : 7;

  cleanupOldFiles(days)
    .then(() => {
      logger.info('File cleanup completed successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error('File cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = {
  cleanupOldFiles
};
