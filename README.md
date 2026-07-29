# QuizSynce

A real-time multiplayer quiz platform. Admins create quizzes from Excel files or AI-generated topics. Players join with a code and compete live on a shared leaderboard.

## Features

- Multiplayer — unlimited players, all synced in real time via Supabase
- Excel import — upload a spreadsheet; AI fills in the answer options if needed
- AI quiz generation — type any topic, get a quiz in seconds (uses OpenRouter free tier)
- Persistent dashboard — quizzes stay until the admin deletes them
- Live leaderboard — scores update instantly as players answer
- Admin panel — password-protected, full control over quizzes
- No Anthropic API key — uses OpenRouter (free models available)

## Stack

- Frontend: React + Vite
- Database + Realtime: Supabase
- AI: OpenRouter (free Mistral / Llama models)
- Excel parsing: SheetJS
- Hosting: Vercel

## Admin Password

Default: `Res2026`

## Setup

1. Create a Supabase project and run `supabase-schema.sql` in the SQL Editor
2. Get a free OpenRouter key at https://openrouter.ai
3. Deploy to Vercel and add environment variables
