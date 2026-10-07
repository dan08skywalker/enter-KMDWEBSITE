import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/kmd/empty-state";
import { useContentPosts } from "@/lib/site/use-content";
import { formatDate } from "@/lib/kmd/format";

const CATEGORY_LABEL: Record<string, string> = {
  blog: "Article",
  news: "News",
  announcement: "Announcement",
  knowledge: "Guide",
};

export function ContentListPage({
  eyebrow,
  title,
  intro,
  categories,
  basePath,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  categories: Array<"blog" | "news" | "announcement" | "knowledge">;
  basePath: string;
}) {
  const { posts, loading, error } = useContentPosts(categories);

  return (
    <SiteShell>
      <PageHero eyebrow={eyebrow} title={title} intro={intro} />

      <Section>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((row) => (
              <Skeleton key={row} className="h-56 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : posts.length === 0 ? (
          <EmptyState
            title="Nothing published here yet"
            description="Articles, news and announcements appear here as soon as the administrator publishes them."
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/shop">Browse the shop instead</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {posts.map((post) => (
              <li key={post.id} className="kmd-panel flex flex-col overflow-hidden">
                {post.cover_image_url ? (
                  <img
                    src={post.cover_image_url}
                    alt=""
                    crossOrigin="anonymous"
                    className="h-44 w-full object-cover"
                  />
                ) : null}
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-foreground">
                      {CATEGORY_LABEL[post.category] ?? post.category}
                    </span>
                    {post.published_at ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(post.published_at)}
                      </span>
                    ) : null}
                  </div>

                  <h2 className="mt-3 text-base font-bold tracking-tight">{post.title}</h2>
                  {post.excerpt ? (
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {post.excerpt}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button asChild variant="brand" size="sm">
                      <Link to={`${basePath}/${post.slug}`}>Read more</Link>
                    </Button>
                    {post.link_url ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={post.link_url} target="_blank" rel="noreferrer noopener">
                          Open link
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </SiteShell>
  );
}

export function ContentArticlePage({
  basePath,
  backLabel,
  categories,
}: {
  basePath: string;
  backLabel: string;
  categories: Array<"blog" | "news" | "announcement" | "knowledge">;
}) {
  const { slug = "" } = useParams();
  const { posts, loading, error } = useContentPosts(categories);
  const post = posts.find((row) => row.slug === slug) ?? null;

  if (loading) {
    return (
      <SiteShell>
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="mt-4 h-40 w-full" />
        </div>
      </SiteShell>
    );
  }

  if (error || !post) {
    return (
      <SiteShell>
        <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6">
          <h1 className="text-2xl font-bold">We could not find that article</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been unpublished or the address may be wrong.
          </p>
          <Button asChild variant="brand" className="mt-6">
            <Link to={basePath}>{backLabel}</Link>
          </Button>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <PageHero
        eyebrow={CATEGORY_LABEL[post.category] ?? post.category}
        title={post.title}
        intro={post.excerpt ?? undefined}
      >
        {post.published_at ? (
          <p className="text-[11px] text-white/60">Published {formatDate(post.published_at)}</p>
        ) : null}
      </PageHero>

      <Section>
        <article className="mx-auto max-w-3xl">
          {post.cover_image_url ? (
            <img
              src={post.cover_image_url}
              alt=""
              crossOrigin="anonymous"
              className="mb-8 w-full rounded-2xl border object-cover"
            />
          ) : null}

          <div className="kmd-prose whitespace-pre-line">{post.body}</div>

          {post.link_url ? (
            <p className="mt-8">
              <Button asChild variant="outline" size="sm">
                <a href={post.link_url} target="_blank" rel="noreferrer noopener">
                  Open the referenced link
                </a>
              </Button>
            </p>
          ) : null}

          <div className="mt-10 border-t pt-6">
            <Button asChild variant="ghost" size="sm" className="px-0 text-accent">
              <Link to={basePath}>
                <ArrowLeft className="h-3.5 w-3.5" />
                {backLabel}
              </Link>
            </Button>
          </div>
        </article>
      </Section>
    </SiteShell>
  );
}
