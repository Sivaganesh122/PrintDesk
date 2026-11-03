# PrintDesk

A full-stack print job management system for educational institutions. Students and departments can upload documents, configure print jobs, and track status, while admins can manage jobs, reports, files, and order workflows. Online payment is not part of this version.

## Features

- Student and department print job submission with file upload
- Up to 10 documents in one order, each with its own pages and print specification
- PDF/document preview and print option capture
- Roll-number and tracking-number based order lookup for your own orders
- Admin login and dashboard
- Print job status management
- Department login
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
PrintDesk/
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
│   ├── scripts/             # File cleanup and password management
│   ├── tests/               # API tests
│   ├── utils/               # Logger helpers
│   └── server.js
├── env.example
├── start.sh
└── package.json
```

## Prerequisites

- Node.js 18+
- npm 8+
- PostgreSQL 13+

## Environment Variables

Copy the template and fill in your values:

```bash
cp env.example server/.env
```

The server will not start without `JWT_SECRET`. See [env.example](env.example) for how to generate one.

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

## Database And Logins

Create the database once with `createdb print_repository`. The server creates and updates its tables each time it starts, without deleting data.

There are no default passwords. The first `admin` user is created from `ADMIN_INITIAL_PASSWORD`. To add a login or change a password:

```bash
cd server
npm run set-password -- admin <username> <password>
npm run set-password -- department <department name> <password>
```

Students register through the app.

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
| Print Jobs (student or department login) | `/api/print-job` |
| Tracking (own orders only) | `/api/tracking` |
| Admin (admin login) | `/api/admin` |
| Reports (admin login) | `/api/reports` |
| Payments (admin login, no gateway connected yet) | `/api/payment` |
| Department Login | `/api/faculty-login` |

## Build

```bash
cd client-vite
npm run build
```

## Tests And Checks

The tests create their own `print_repository_test` database and temporary upload folder, so they don't touch your data. They use the database login from `server/.env`.

```bash
cd server
npm test
npm run lint
```

## Notes

- Keep `.env` files and uploaded documents out of commits.
- Confirm PostgreSQL is running before starting the backend.
