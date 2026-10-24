import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { SERIES } from './data/series';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    // Lab series this post is part of, and its position in that series.
    series: z.enum(SERIES).optional(),
    part: z.number().int().nonnegative().optional(),
    // The project page this post documents (file name in src/content/projects).
    project: reference('projects').optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    // One or two sentences shown on cards and the homepage.
    summary: z.string(),
    status: z.enum(['Active', 'In progress', 'Planned', 'Complete']),
    tags: z.array(z.string()).min(1),
    // Tools and platforms used, shown on the project page.
    stack: z.array(z.string()).default([]),
    // Show on the homepage. Keep this to 3–4 projects.
    featured: z.boolean().default(false),
    // Lower numbers sort first on the homepage and projects page.
    order: z.number().default(100),
    started: z.coerce.date().optional(),
    repo: z.string().url().optional(),
    link: z.string().url().optional(),
  }),
});

// Short posts: quick findings, commands that worked, small thoughts.
const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

// Link log: something worth reading elsewhere, with a line or two of commentary in the body.
const links = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/links' }),
  schema: z.object({
    title: z.string(),
    url: z.string().url(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog, projects, notes, links };
