#!/bin/bash

# PrintDesk setup script

set -e

if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js v18+ first."
    exit 1
fi

if [ ! -f "server/.env" ]; then
    echo "Creating server/.env..."
    cp env.example server/.env
    echo "Please edit server/.env with your database password and JWT_SECRET before starting."
fi

if [ ! -f "client-vite/.env" ]; then
    echo "Creating client-vite/.env..."
    echo "VITE_API_URL=http://localhost:5001" > client-vite/.env
fi

echo "Installing dependencies..."
npm install
npm run install-all

echo ""
echo "Setup complete. Next steps:"
echo "1. Make sure PostgreSQL is running and the database exists: createdb print_repository"
echo "2. Edit server/.env"
echo "3. Start the app: npm run dev"
echo "4. Open http://localhost:5173"
