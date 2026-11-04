# Prima Notebook

A collaborative notebook workspace built with Next.js and Supabase.

## Stack

- Next.js App Router + React + TypeScript
- Supabase Auth and Postgres with Row Level Security
- Tailwind CSS v4
- Vercel deployment

## Local setup

1. Use Node.js 22 or later.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set the Supabase project URL and publishable key.
5. Start the app with `npm run dev`.

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never put a Supabase service-role or secret key in a `NEXT_PUBLIC_` variable or in this repository.

## Current MVP

- Email/password registration and login
- Workspace creation and selection
- Notebook creation
- Page creation, title editing, and saving page content
- Responsive dark interface

## Next milestones

- Rich-text editor (TipTap)
- Realtime collaboration and online presence (Yjs + Supabase Realtime)
- Workspace invitations and share permissions
- Autosave, image uploads, checklists, and tables

The Supabase database schema is already present in the connected project. Keep Row Level Security enabled for all user-facing tables.
