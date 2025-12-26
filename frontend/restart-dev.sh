#!/bin/bash

# Kill any existing dev servers
echo "Stopping existing dev servers..."
lsof -ti:5173,5174 2>/dev/null | xargs kill -9 2>/dev/null
pkill -f "vite.*frontend" 2>/dev/null

# Wait a moment
sleep 1

# Start dev server
echo "Starting dev server..."
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
npm run dev

