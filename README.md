# BrowseComp Prompt Studio

A private-by-design prompt workspace for maintaining canonical prompts, project-specific variants, source URLs, logic traces, submissions, archives, and LLM pass/fail test records.

Each deployment uses its own Cloudflare D1 database. A fresh installation contains one project named **Sample** and no prompts, variants, URLs, submissions, or model-test records.

## What you need

- A GitHub account
- A Cloudflare account
- Node.js 22.13 or newer

## Create your independent copy

1. Select **Use this template** on GitHub, then **Create a new repository**.
2. Clone your new repository to your computer.
3. In the project folder, run:

   ```bash
   npm install
   npx wrangler login
   npx wrangler d1 create browsecomp-prompt-studio
   ```

4. Copy the `database_id` printed by Cloudflare.
5. Set it before deploying.

   macOS or Linux:

   ```bash
   export CLOUDFLARE_D1_DATABASE_ID="your-database-id"
   npm run deploy
   ```

   Windows PowerShell:

   ```powershell
   $env:CLOUDFLARE_D1_DATABASE_ID="your-database-id"
   npm run deploy
   ```

6. Open the URL printed after deployment. The first request creates the required tables and the Sample project automatically.

## Local development

Copy `.env.example` to `.env.local`, replace the placeholder database ID if needed, then run:

```bash
npm install
npm run dev
```

## Privacy and access

Each installation has a separate D1 database; users do not share prompt data. A newly deployed Cloudflare Worker is reachable through its URL unless the owner adds an access policy. For a private installation, protect it with Cloudflare Access before storing sensitive prompts.

Never commit `.env` files, API tokens, database exports, or real prompt data. This template intentionally excludes the original developer's hosting identifiers and database contents.

## Updating the application

Pull changes from the template into your repository, review them, and run `npm run deploy` again with your D1 database ID set. Existing records remain in your database.

## Available commands

- `npm run dev` — start local development
- `npm run build` — create a production build
- `npm run deploy` — build and deploy to Cloudflare Workers
- `npm run lint` — check the source
- `npm test` — build and run the included smoke test

## License

No open-source license has been selected yet. The repository owner should choose a license before making the template public.
