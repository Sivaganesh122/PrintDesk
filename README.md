# MCET Print Repository

A full-stack print job management system for educational institutions. Students can upload documents, configure print jobs, make payments, and track status, while admins can manage jobs, reports, files, and order workflows.

## Features

- Student print job submission with file upload
- PDF/document preview and print option capture
- Roll-number and tracking-number based order lookup
- Admin login and dashboard
- Print job status management
- Payment record handling
- Faculty login route
- Sales and print-type reporting APIs
- Local file storage with scheduled cleanup support
- PostgreSQL-backed metadata storage

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React, Vite, Axios |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Auth | JWT |
| Uploads | Multer, local storage |
| Security | Helmet, CORS, rate limiting |
| Jobs | node-cron |
| Logging | Winston, Morgan |

## Project Structure

```text
MCET-Repo/
├── client-vite/             # React/Vite frontend
│   └── src/
│       ├── components/
│       ├── context/
│       ├── pages/
│       ├── services/
│       └── utils/
├── server/                  # Express API
│   ├── config/              # Database and storage config
│   ├── middleware/          # Auth, upload, error handling
│   ├── routes/              # API route modules
│   ├── scripts/             # Cleanup and file utilities
│   ├── utils/               # Logger helpers
│   └── server.js
├── env.example
├── start.sh
└── package.json
```

## Prerequisites

- Node.js 16+
- npm 8+
- PostgreSQL

## Environment Variables

Copy the template and fill in your values:

```bash
cp env.example .env
cp env.example server/.env
```

Common server values:

```env
PORT=5001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=print_repository
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=change_this_secret
```

Set the frontend API URL for local development:

```bash
echo "VITE_API_URL=http://localhost:5001" > client-vite/.env
```

## Installation

Install root, backend, and frontend dependencies:

```bash
npm install
cd server && npm install
cd ../client-vite && npm install
```

## Run Locally

Start the backend:

```bash
cd server
npm run dev
```

Start the frontend in another terminal:

```bash
cd client-vite
npm run dev
```

Default local URLs:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:5001
Health:   http://localhost:5001/health
```

## Main API Routes

| Area | Base Route |
| --- | --- |
| Admin Auth | `/api/auth` |
| Print Jobs | `/api/print-job` |
| Payments | `/api/payment` |
| Tracking | `/api/tracking` |
| Admin | `/api/admin` |
| Reports | `/api/reports` |
| Faculty Login | `/api/faculty-login` |

## Build

```bash
cd client-vite
npm run build
```

## Tests And Checks

Backend test and lint scripts are available from the server package:

```bash
cd server
npm test
npm run lint
```

## Notes

- Keep `.env` files and uploaded documents out of commits.
- Confirm PostgreSQL is running before starting the backend.
- The root package still contains older `client` script names; the active frontend in this branch is `client-vite`.
