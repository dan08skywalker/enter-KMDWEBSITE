import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ContentPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  category: "blog" | "news" | "announcement" | "knowledge";
  cover_image_url: string | null;
  link_url: string | null;
  is_pinned: boolean;
  published_at: string | null;
}

/**
 * Published articles, news and announcements.
 *
 * Only rows the administrator has published are readable, so an unpublished
 * draft never leaks into the public feed.
 */
export function useContentPosts(categories: ContentPost["category"][]) {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void (async () => {
      const { data, error: queryError } = await supabase
        .from("content_posts")
        .select("id, slug, title, excerpt, body, category, cover_image_url, link_url, is_pinned, published_at")
        .eq("is_published", true)
        .in("category", categories)
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false });

      if (!active) return;

      if (queryError) {
        console.error("Could not load published content:", queryError.message);
        setError("Content could not be loaded just now. Please refresh the page.");
        setLoading(false);
        return;
      }

      setPosts((data ?? []) as ContentPost[]);
      setError(null);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
    // The category list is a small constant at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.join(",")]);

  return { posts, loading, error };
}
