import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getPosts, urlDoPost } from '../utils/posts';
import { SITE_TITLE, SITE_DESCRIPTION, SITE_LANG } from '../consts';

export const GET: APIRoute = async (context) => {
  const posts = await getPosts();

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site!,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: urlDoPost(post),
      categories: [post.data.category, ...(post.data.tags ?? [])],
      author: post.data.author,
    })),
    customData: `<language>${SITE_LANG}</language>`,
  });
};
