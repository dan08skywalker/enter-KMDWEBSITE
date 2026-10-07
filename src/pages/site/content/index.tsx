import { ContentArticlePage, ContentListPage } from "@/components/site/content-pages";

export function BlogListPage() {
  return (
    <ContentListPage
      eyebrow="News & updates"
      title="Articles, guides and company news"
      intro="Product education, announcements about new stock, and news from the KMD Empire team."
      categories={["blog", "news"]}
      basePath="/blog"
    />
  );
}

export function BlogArticlePage() {
  return (
    <ContentArticlePage basePath="/blog" backLabel="All articles" categories={["blog", "news"]} />
  );
}

export function AnnouncementsListPage() {
  return (
    <ContentListPage
      eyebrow="Announcements"
      title="Announcements and community updates"
      intro="Promotions, restocks and community news from KMD Empire."
      categories={["announcement"]}
      basePath="/announcements"
    />
  );
}

export function AnnouncementArticlePage() {
  return (
    <ContentArticlePage
      basePath="/announcements"
      backLabel="All announcements"
      categories={["announcement"]}
    />
  );
}

export default BlogListPage;
