Houseworks is a local Monday.com-style board prototype built with Next.js (App Router), tRPC, Prisma, NextAuth, and a BullMQ worker for automations.

[![GitHub Repo](https://img.shields.io/badge/GitHub-houseworks-blue?logo=github)](https://github.com/tag-v/houseworks)

## Getting Started

### 1) Configure env

- Copy `.env.example` to `.env` and adjust if needed.
- Default web URL is `http://localhost:3002` (the dev script runs on 3002).

### 2) Start dependencies (Postgres + Redis)

This project expects Postgres on `localhost:5432` and Redis on `localhost:6379`.

If you have Docker Desktop running:

```bash
bash scripts/dev-up.sh
```

### 3) Run the web app + worker

```bash
npm run dev
```

In a second terminal:

```bash
npm run worker
```

Open `http://localhost:3002` to view the app.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
