# Vercel Serverless Function configuration for the Python G2P service
#
# NOTE: This file is intentionally NOT named `vercel.json` — a `vercel.json`
# here would be invalid (Vercel only consumes the project-root one, and the
# previous TOML-style content with `#` comments was not valid JSON anyway).
#
# This service is excluded from Vercel deployment via the root `.vercelignore`
# because it depends on `espeak-ng`, a system package not available on
# Vercel's Python runtime. Deploy it on a platform that supports custom
# system dependencies (Fly.io, Render, Docker on Cloud Run, etc.).
#
# Intended Vercel function configuration if it were deployable:
#   runtime    = python3.9
#   maxDuration = 60s
#   memory     = 1024 MB
