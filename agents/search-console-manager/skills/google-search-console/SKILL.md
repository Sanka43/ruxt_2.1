# Google Search Console Management & Technical SEO

This skill provides step-by-step technical procedures to manage, audit, and optimize websites using Google Search Console and technical search engine guidelines.

---

## 1. Search Analytics Performance Optimization

### Key Dimensions & Metrics
When analyzing search performance, evaluate these 4 core metrics across 4 primary dimensions:
- **Clicks:** Total count of users who clicked from Google SERP to your domain.
- **Impressions:** How many times a user saw your link in search results.
- **CTR (Click-Through Rate):** `(Clicks / Impressions) * 100`.
- **Average Position:** Mean ranking on Google for queries and pages.

### High-Impact Optimization Tactics
1. **Low Hanging Fruit (Position 4 - 9):**
   - Filter queries with high impressions (>10,000/mo) ranking on positions 4 to 9.
   - Refactor the page `<title>` tag to include the exact match high-volume keyword near the start.
   - Add high-CTR trigger words (e.g. *Guide, 2026, Free, Fast, Checklist, Complete*).
   - Expected Result: CTR increase from ~3% to ~8%, doubling organic clicks without extra backlinks.
2. **Featured Snippet Opportunities (Position 1 - 3):**
   - For queries in top 3, add direct definition boxes (40-50 words paragraph answering the query immediately) or structured HTML `<table>` / `<ol>` lists to capture Position 0.

---

## 2. URL Inspection & Indexing Diagnostics

### Decoding Google Indexing Verdicts
| GSC Index Status | Root Cause | Exact Resolution |
| :--- | :--- | :--- |
| **Discovered - currently not indexed** | Google knows the URL exists but hasn't crawled it due to crawl budget or low site authority. | Add 3-5 internal links from top-performing pages. Submit directly via URL Inspection tool. |
| **Crawled - currently not indexed** | Google crawled the page but decided the content does not provide unique search value. | Consolidate content, increase word count, add unique data/media, eliminate duplicate template boilerplate. |
| **Duplicate without user-selected canonical** | Google detected multiple URLs showing the same or similar content with no canonical tag. | Add explicit `<link rel="canonical" href="https://example.com/canonical-url">` in `<head>`. |
| **Soft 404** | Page returns 200 OK header, but body says "Not Found" or is nearly empty. | Return a true 404/410 HTTP status header or populate substantial page content. |
| **Blocked by robots.txt** | `robots.txt` file contains `Disallow: /path/` matching the target URL. | Inspect `robots.txt`, remove conflicting pattern, and test with Google's robots tester. |

---

## 3. Sitemaps Management
- **Format:** Clean XML sitemap following the `sitemap.xml` standard (`<urlset>`, `<url>`, `<loc>`, `<lastmod>`).
- **Cleanliness:** Ensure only 200 OK canonical URLs are listed in the sitemap. Never include 301 redirects, 404 pages, or `noindex` pages.
- **Verification:** Submit sitemap URL in GSC under `Index > Sitemaps` and monitor `Discovered URLs` count.
