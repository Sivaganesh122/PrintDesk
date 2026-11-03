# File Storage

Uploaded documents are stored in `server/uploads/`. Their metadata is stored in the `print_jobs` table in PostgreSQL.

## Uploading

Students and departments submit an order with `POST /api/print-job/create`. A login token is required.

Send the files in the `files` field and their specifications as a JSON array in the `documents` field, in the same order. Each document becomes one row in `print_jobs`, and the rows of an order share an `order_number`. If any file or specification is invalid, nothing from the order is stored.

- An order can have up to 10 documents.
- Allowed types come from `ALLOWED_FILE_TYPES` (default: pdf, doc, docx, jpg, jpeg, png).
- The size limit comes from `MAX_FILE_SIZE` in bytes (default: 25MB).
- The file's leading bytes must match its extension, so a renamed file is rejected.
- Files are stored under a generated name. The original name is kept in `print_jobs.original_filename`.

## Downloading

Files are not served statically. Admins fetch them with `GET /api/admin/print-jobs/:id/file`. A cancelled job's file can't be fetched.

## Cleanup

In production, a job runs daily at 2 AM and deletes the files of completed, delivered and cancelled jobs after 7 days. The print job records are kept and their `file_path` is cleared.

To run it by hand:

```bash
# Delete files of jobs finished more than 7 days ago (default)
node scripts/cleanupFiles.js

# Keep files for 3 days instead
node scripts/cleanupFiles.js 3
```
