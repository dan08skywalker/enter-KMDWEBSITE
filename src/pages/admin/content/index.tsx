import { useCallback, useEffect, useState } from "react";
import { Loader2, Newspaper } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/kmd/page-header";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invokeFunction } from "@/lib/kmd/invoke";
import { formatDateTime } from "@/lib/kmd/format";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  category: string;
  cover_image_url: string | null;
  link_url: string | null;
  is_published: boolean;
  is_pinned: boolean;
  published_at: string | null;
}

interface PostForm {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  coverImageUrl: string;
  linkUrl: string;
  isPublished: boolean;
  isPinned: boolean;
}

const EMPTY: PostForm = {
  slug: "",
  title: "",
  excerpt: "",
  body: "",
  category: "blog",
  coverImageUrl: "",
  linkUrl: "",
  isPublished: false,
  isPinned: false,
};

export default function AdminContent() {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [form, setForm] = useState<PostForm | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("content_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load content:", error.message);
      setPosts([]);
    } else {
      setPosts((data ?? []) as Post[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!form) return;
    if (!form.title.trim() || !form.slug.trim()) {
      toast.error("A title and a slug are both required");
      return;
    }
    setBusy(true);

    const outcome = await invokeFunction<{ reasonText?: string }>("admin-actions", {
      action: "save_content",
      payload: {
        id: form.id ?? null,
        slug: form.slug.trim(),
        title: form.title.trim(),
        excerpt: form.excerpt.trim() || null,
        body: form.body.trim() || null,
        category: form.category,
        coverImageUrl: form.coverImageUrl.trim() || null,
        linkUrl: form.linkUrl.trim() || null,
        isPublished: form.isPublished,
        isPinned: form.isPinned,
      },
    });

    setBusy(false);

    if (!outcome.ok) {
      toast.error(outcome.error ?? "The article could not be saved");
      return;
    }
    toast.success(outcome.data?.reasonText ?? "Article saved");
    setForm(null);
    void load();
  };

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements & blog"
        description="Everything published here appears on the public News, Announcements and Knowledge pages. Drafts stay invisible until you publish them."
        actions={
          <Button type="button" variant="brand" size="sm" onClick={() => setForm({ ...EMPTY })}>
            <Newspaper className="h-3.5 w-3.5" />
            New article
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-20 w-full" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="Nothing published yet"
          description="Publish an announcement, a news item or a guide and it appears on the public site straight away."
        />
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.id} className="kmd-panel flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{post.title}</p>
                  {post.is_pinned ? <StatusBadge label="Pinned" tone="gold" /> : null}
                  {post.is_published ? (
                    <StatusBadge label="Published" tone="success" />
                  ) : (
                    <StatusBadge label="Draft" tone="neutral" />
                  )}
                </div>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  /{post.category}/{post.slug}
                  {post.published_at ? ` · published ${formatDateTime(post.published_at)}` : ""}
                </p>
                {post.excerpt ? (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{post.excerpt}</p>
                ) : null}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm({
                    id: post.id,
                    slug: post.slug,
                    title: post.title,
                    excerpt: post.excerpt ?? "",
                    body: post.body ?? "",
                    category: post.category,
                    coverImageUrl: post.cover_image_url ?? "",
                    linkUrl: post.link_url ?? "",
                    isPublished: post.is_published,
                    isPinned: post.is_pinned,
                  })
                }
              >
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}

      {form ? (
        <div className="kmd-panel p-6">
          <p className="text-sm font-semibold">{form.id ? "Edit article" : "New article"}</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="post-title">Title</Label>
              <Input
                id="post-title"
                value={form.title}
                onChange={(event) =>
                  setForm({
                    ...form,
                    title: event.target.value,
                    slug: form.id ? form.slug : slugify(event.target.value),
                  })
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="post-slug">Slug</Label>
              <Input
                id="post-slug"
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
                className="mt-1.5 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="post-category">Section</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm({ ...form, category: value })}
              >
                <SelectTrigger id="post-category" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="announcement">Announcements</SelectItem>
                  <SelectItem value="blog">Blog article</SelectItem>
                  <SelectItem value="news">News &amp; updates</SelectItem>
                  <SelectItem value="knowledge">Knowledge centre guide</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="post-cover">Cover image URL (optional)</Label>
              <Input
                id="post-cover"
                value={form.coverImageUrl}
                onChange={(event) => setForm({ ...form, coverImageUrl: event.target.value })}
                className="mt-1.5"
                placeholder="/products/dokudami.png"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="post-excerpt">Summary</Label>
              <Textarea
                id="post-excerpt"
                value={form.excerpt}
                onChange={(event) => setForm({ ...form, excerpt: event.target.value })}
                rows={2}
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="post-body">Body</Label>
              <Textarea
                id="post-body"
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
                rows={8}
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="post-link">External link (optional)</Label>
              <Input
                id="post-link"
                value={form.linkUrl}
                onChange={(event) => setForm({ ...form, linkUrl: event.target.value })}
                className="mt-1.5"
                placeholder="https://…"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs font-semibold">Published</p>
                <p className="text-[11px] text-muted-foreground">
                  Unpublished articles are invisible to the public.
                </p>
              </div>
              <Switch
                checked={form.isPublished}
                onCheckedChange={(checked) => setForm({ ...form, isPublished: checked })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs font-semibold">Pin to the top</p>
                <p className="text-[11px] text-muted-foreground">Pinned items list first.</p>
              </div>
              <Switch
                checked={form.isPinned}
                onCheckedChange={(checked) => setForm({ ...form, isPinned: checked })}
              />
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button type="button" variant="brand" disabled={busy} onClick={() => void save()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save article
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
