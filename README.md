# rre.org.uk

Static Astro site for **Real Resource Economics** — Stephen Laughton's author and
book site supporting *The Money Sham* (Lola Books, 2026).

## Stack

- [Astro 5](https://astro.build) (static output, no SSR)
- [Tailwind CSS v4](https://tailwindcss.com) via the Vite plugin
- [Inter](https://rsms.me/inter/) self-hosted via `@fontsource/inter`
- `serve` for static hosting on Railway via Railpack

## Local development

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # builds to dist/
npm start        # serves dist/ on PORT (default 3000)
```

## Content

- Most copy is **placeholder** pending Steve's input.
- The glossary at `/glossary` is sourced from the SEF Knowledge Graph
  (`c:\Dev\Claude\SEF-social\db.sqlite3`); placeholders marked `[TODO]` will
  be replaced as more KG concepts are published.
- Book cover image was fetched from the Lola Books product page.

## Deployment

- Hosted on Railway under the service name `rre-org-uk`.
- Builder: Railpack (auto-detects Node + `npm run build`).
- Start command: `npx serve dist --listen tcp://0.0.0.0:$PORT`
- Production domain `rre.org.uk` to be added via Railway custom domain.
