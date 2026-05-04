This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Lokale Entwicklung

```bash
npm install
npm run dev
# → http://localhost:8080 (siehe package.json)
```

## Produktion (MVP) — Umgebungsvariable

Die Routen **`/api/approve-draft`** und **`/api/generate`** signieren die Freigabe mit einem Server-Geheimnis. Ohne gesetztes **`APPROVAL_SECRET`** schlagen Freigabe und Rechnungsexport in **Production** fehl (API antwortet mit Konfigurationsfehler).

| Variable | Erforderlich | Hinweis |
|----------|--------------|---------|
| `APPROVAL_SECRET` | **Ja**, sobald `NODE_ENV=production` | Zufällige, lange Zeichenkette (z. B. `openssl rand -hex 32`). Nicht committen. |

**Vercel** war nur als typisches Hosting für `rgform.berent.ai` gemeint — dasselbe gilt für **jeden** Production-Host (Cloudflare Pages, eigener Node-Server, …): dort `APPROVAL_SECRET` in den **Environment Variables** des Projekts anlegen und ein neues Deployment auslösen.

**Was du nachziehen musst:**

1. Ein Geheimnis erzeugen, z. B. `openssl rand -hex 32`.
2. Im Hosting-Dashboard (z. B. Vercel → Projekt → Settings → Environment Variables) **`APPROVAL_SECRET`** für **Production** setzen.
3. Redeploy, damit die Variable aktiv wird.

Lokal ohne gesetzte Variable: es gibt einen **nur für Development** gedachten Fallback (unsicher, nie für Production nutzen).

## Vorlage DOCX

```bash
npm run build:template
```

Erzeugt `assets/templates/invoice-template.docx` aus `quellen/Vorlage-HPCN-Rechnung.docx`.

---

## Getting Started (create-next-app)

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
