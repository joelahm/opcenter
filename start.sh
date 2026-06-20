#!/bin/bash

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     Fritzie Dashboard Setup          ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found. Install Docker Desktop from https://docker.com"
  exit 1
fi

if ! docker info &> /dev/null; then
  echo "❌ Docker is not running. Please start Docker Desktop."
  exit 1
fi

echo "✅ Docker is running"
echo ""

echo "🚀 Starting database container (first run may take 3-5 min)..."
echo ""

docker compose up --build -d

echo ""
echo "⏳ Waiting for database to be ready..."
sleep 10

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✅ Fritzie database is running!     ║"
echo "║                                      ║"
echo "║  Run: npm run dev                    ║"
echo "║  Open: http://localhost:3000         ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "To stop:    docker compose down"
echo "To restart: docker compose up -d"
echo "DB logs:    docker compose logs -f db"
echo ""
