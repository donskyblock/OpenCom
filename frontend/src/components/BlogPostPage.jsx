import { useEffect, useState } from "react";
import { BlogMarkdown } from "../lib/blogMarkdown";

function formatBlogDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Unscheduled";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function BlogPostPage({
  coreApi,
  slug,
  onOpenHome,
  onOpenBlogs,
  onOpenTerms,
  onOpenApp,
}) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    window.scrollTo(0, 0);

    (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `${coreApi}/v1/blogs/${encodeURIComponent(slug)}`,
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || `HTTP_${response.status}`);
        }
        if (!cancelled) setPost(data.post || null);
      } catch (err) {
        if (!cancelled) {
          setPost(null);
          setError(err instanceof Error ? err.message : "Failed to load post.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coreApi, slug]);

  return (
    <div className="blogs-shell">
      <header className="blogs-topbar">
        <div className="blogs-topbar-actions">
          <button type="button" className="ghost" onClick={onOpenBlogs}>
            All blogs
          </button>
          <button type="button" className="ghost" onClick={onOpenHome}>
            Home
          </button>
        </div>
        <div className="blogs-topbar-actions">
          <button type="button" className="ghost" onClick={onOpenTerms}>
            Terms
          </button>
          <button type="button" onClick={onOpenApp}>
            Open app
          </button>
        </div>
      </header>

      <main className="blogs-main">
        {loading && (
          <section className="blogs-state-card">
            <h2>Loading post</h2>
            <p>Pulling the published article from the OpenCom API.</p>
          </section>
        )}

        {!loading && error && (
          <section className="blogs-state-card">
            <h2>Post unavailable</h2>
            <p>{error}</p>
            <button type="button" onClick={onOpenBlogs}>
              Back to all blogs
            </button>
          </section>
        )}

        {!loading && !error && post && (
          <article className="blog-post-card">
            <div className="blogs-meta-row">
              <span>{formatBlogDate(post.publishedAt)}</span>
              <span>{post.readingMinutes} min read</span>
              <span>{post.authorName}</span>
            </div>
            <h1>{post.title}</h1>
            <p className="blog-post-summary">{post.summary}</p>
            <BlogMarkdown content={post.content || ""} className="blog-post-content" />
          </article>
        )}
      </main>
    </div>
  );
}
