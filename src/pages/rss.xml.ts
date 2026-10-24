import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts, getNotes, getLinks } from '../lib/content';

export async function GET(context: APIContext) {
  const [posts, notes, links] = await Promise.all([getPosts(), getNotes(), getLinks()]);

  const items = [
    ...posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: p.data.description,
      link: `/blog/${p.id}/`,
      categories: ['post', ...(p.data.series ? [p.data.series] : [])],
    })),
    ...notes.map((n) => ({
      title: `Note: ${n.data.title}`,
      pubDate: n.data.date,
      description: n.body?.slice(0, 280),
      link: `/notes/${n.id}/`,
      categories: ['note', ...n.data.tags],
    })),
    ...links.map((l) => ({
      title: `Link: ${l.data.title}`,
      pubDate: l.data.date,
      description: l.body?.trim(),
      link: l.data.url,
      categories: ['link', ...l.data.tags],
    })),
  ].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

  return rss({
    title: 'Leonardo Borges',
    description: 'Identity, cloud security and homelab notes from Leonardo Borges.',
    site: context.site!,
    items,
  });
}
