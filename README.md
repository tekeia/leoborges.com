# leoborges.com

Personal site of Leo Borges — identity security (IAM + cloud). Built with Astro and Tailwind; every push to `master` deploys to GitHub Pages.

## Adding a project

Create `src/content/projects/<slug>.md`:

```md
---
title: "Project name"
summary: "One or two sentences for cards and the homepage."
status: off            # active | briefly-paused | off | abandoned
tags: [IAM, Cloud, Azure]   # drive the filter on /projects
stack: [Tool, Platform]
featured: true         # shows on the homepage (keep to 3–4)
order: 5               # lower sorts first
repo: https://github.com/tekeia/...   # optional
---

Goal, architecture, what's working, what's next.
```

## Adding a lab post

Create `src/content/blog/<slug>.md`:

```md
---
title: "Cloud Lab #1: ..."
date: 2026-11-01
description: "..."
series: "Cloud Lab"    # IAM Lab | Cloud Lab | Security Lab (list lives in src/data/series.ts)
part: 1
project: hybrid-identity-entra   # project file name; the post appears on that project page
tags: [Azure, Entra ID]
draft: false
---
```

Series navigation (part X of Y, previous/next) and the project link are generated from these fields.

## Adding a note

Create `src/content/notes/<yyyy-mm-dd-slug>.md` with `title`, `date` and optional `tags`, then write the note in the body. Notes show in full on `/notes` and get their own page.

## Adding a link

Create `src/content/links/<yyyy-mm-dd-slug>.md` with `title`, `url`, `date` and optional `tags`; the body is your one- or two-line comment.

## Now and Uses

Edit `src/pages/now.astro` (bump the `updated` date) and `src/pages/uses.astro`.

## Commands

| Command           | Action                              |
| :---------------- | :---------------------------------- |
| `npm install`     | Install dependencies                |
| `npm run dev`     | Dev server at `localhost:4321`      |
| `npm run build`   | Build to `./dist/`                  |
| `npm run preview` | Preview the build locally           |
