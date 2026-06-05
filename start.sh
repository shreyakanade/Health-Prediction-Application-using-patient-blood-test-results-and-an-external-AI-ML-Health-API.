#!/usr/bin/env bash
# ─────────────────────────────────────────────────
# MIRA Startup Script
# ─────────────────────────────────────────────────

set -e

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   MIRA — Medical Intelligence        ║"
echo "  ║   Robotic Automation Platform        ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "❌ Python 3 is required. Please install it first."
  exit 1
fi

# Check ANTHROPIC_API_KEY
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️  Warning: ANTHROPIC_API_KEY is not set."
  echo "   AI predictions will return a placeholder message."
  echo "   Set it with: export ANTHROPIC_API_KEY=your_key_here"
  echo ""
fi

# Install deps if needed
cd "$(dirname "$0")/backend"
if [ ! -d ".venv" ]; then
  echo "📦 Creating virtual environment..."
  python3 -m venv .venv
fi

echo "📦 Installing dependencies..."
.venv/bin/pip install -q -r requirements.txt

echo ""
echo "🚀 Starting MIRA on http://localhost:5000"
echo "   Press Ctrl+C to stop."
echo ""

FLASK_APP=app.py .venv/bin/python app.py
