import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;
export type Project = CollectionEntry<'projects'>;

/** Published posts, newest first. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  // Same-day posts in a series: higher part number counts as newer.
  return posts.sort(
    (a, b) =>
      b.data.date.valueOf() - a.data.date.valueOf() ||
      (b.data.part ?? 0) - (a.data.part ?? 0)
  );
}

/** Posts in a series, in reading order (part, then date). */
export function inSeriesOrder(posts: Post[]): Post[] {
  return [...posts].sort(
    (a, b) =>
      (a.data.part ?? 0) - (b.data.part ?? 0) ||
      a.data.date.valueOf() - b.data.date.valueOf()
  );
}

/** Projects by `order`, then title. */
export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection('projects');
  return projects.sort(
    (a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title)
  );
}

export function postsForProject(posts: Post[], projectId: string): Post[] {
  return inSeriesOrder(posts.filter((p) => p.data.project?.id === projectId));
}

export const tagSlug = (tag: string) => tag.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const formatDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
