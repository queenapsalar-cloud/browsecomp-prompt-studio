# BrowseComp Prompt Studio

A private-by-design prompt workspace for maintaining canonical prompts, project-specific variants, source URLs, logic traces, submissions, archives, and LLM pass/fail test records.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/queenapsalar-cloud/browsecomp-prompt-studio)

## Install your independent copy

Select **Deploy to Cloudflare** above, then:

1. Sign in to Cloudflare and GitHub when prompted.
2. Choose the GitHub repository name and Cloudflare Worker name for your copy.
3. Accept the displayed configuration and select **Deploy**.
4. Wait for the build to finish, then open the new `workers.dev` URL.

Cloudflare copies the source into the installer’s GitHub account, creates and binds a separate D1 database, deploys the application, and enables automatic deployments from future repository changes. No terminal, local Node.js installation, or manually copied database ID is required.

A fresh installation contains:

- One project named **Sample**
- No prompts or variants
- No source URLs
- No submissions or archives
- No LLM test records

## Protect the website before adding prompts

A new `workers.dev` URL is public until its owner enables access protection:

1. Open the [Cloudflare dashboard](https://dash.cloudflare.com/).
2. Go to **Workers & Pages** and select the new Worker.
3. Open **Settings → Domains & Routes**.
4. Beside the `workers.dev` route, select **Enable Cloudflare Access**.
5. Choose **Manage Cloudflare Access** and allow only the owner’s email address or intended users.

Do this before storing sensitive prompt material.

## Use and update the website

After deployment, ordinary use happens entirely through the new website URL. Each installation and database is independent.

Cloudflare Workers Builds watches the copied GitHub repository. Pushing a change to its production branch automatically rebuilds and deploys the website. Pull requests can receive preview deployments.

## Manual installation fallback

For users who prefer terminal-based deployment:

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/YOUR-USERNAME/browsecomp-prompt-studio.git
   cd browsecomp-prompt-studio
   npm install
   ```

2. Authorize Cloudflare and create a D1 database:

   ```bash
   npx wrangler login
   npx wrangler d1 create browsecomp-prompt-studio
   ```

3. Replace the placeholder `database_id` in `wrangler.jsonc` with the ID printed by Cloudflare.
4. Deploy:

   ```bash
   npm run deploy
   ```

The application creates its tables and Sample project on first use.

## Local development

```bash
npm install
npm run dev
```

Local development uses a local D1 database managed by Wrangler. Real deployment data remains in the remote database.

## Privacy

Each installation uses its own D1 database; users do not share prompt data. Never commit `.env` files, API tokens, database exports, or real prompt data. This template excludes the original developer’s hosting identifiers and database contents.

## Available commands

- `npm run dev` — start local development
- `npm run build` — create a production build
- `npm run deploy` — build and deploy to Cloudflare Workers
- `npm run lint` — check the source
- `npm test` — build and run the included smoke test

## License

This software is licensed under the [PolyForm Perimeter License 1.0.0](LICENSE). Professional, commercial, modification, and redistribution uses are permitted under its terms, except for providing others with a product that competes with this software.
