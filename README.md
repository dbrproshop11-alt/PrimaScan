# Prima Notebook

A collaborative notebook workspace built with Next.js and Supabase.

## Stack

- Next.js App Router + React + TypeScript
- Supabase Auth, Postgres, Row Level Security, and Realtime
- Tailwind CSS v4
- Vercel deployment

## Local setup

1. Use Node.js 22 or later.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev`.

The connected Prima Notebook Supabase project is configured as the default client. To override it for another environment, copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The browser uses only the public publishable key. Never put a Supabase service-role or secret key in a `NEXT_PUBLIC_` variable or in this repository. Row Level Security must remain enabled.

## Current MVP

- Email/password registration and login
- Workspace creation and selection
- Notebook and page creation
- Page title editing
- Automatic saving of page content
- Live page updates through Supabase Realtime
- Responsive dark interface

## Next milestones

- Rich-text editor (TipTap) with headings, lists, tables, and checklists
- Yjs-based concurrent collaborative editing and presence
- Workspace invitations and share permissions
- Image uploads and light/dark theme switching

The database schema is already present in the connected Supabase project.
