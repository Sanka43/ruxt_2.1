# Live Web Traffic Analytics & Scheduled Reporting

This skill provides operational procedures for measuring real-time website traffic, deploying tracking beacons, monitoring live server health, and orchestrating scheduled executive reports.

---

## 1. Real-Time Web Traffic Radar

### Monitoring Active Concurrency
- Real-time traffic measures visitors active within the last 5 to 15 minutes.
- Break down concurrent visitors into:
  - **Active URLs:** Identifies trending blog posts, product landing pages, or viral campaigns.
  - **Referral Attribution:** Distinguishes Google organic traffic surges from direct navigation or social referrals.
  - **Device Split:** Ensures mobile experience is flawless if mobile share exceeds 50%.

### Live Tracking Beacon Integration
To stream live hits from any live website into the RuXt Command Center, embed this lightweight, privacy-focused snippet into the site `<head>` or before `</body>`:

```html
<!-- RuXt Live Traffic Radar Beacon -->
<script>
  (function() {
    try {
      var endpoint = 'http://localhost:1234/api/gsc/traffic/beacon';
      var payload = {
        site_url: window.location.origin,
        page_url: window.location.pathname + window.location.search,
        referrer: document.referrer || 'Direct'
      };
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, JSON.stringify(payload));
      } else {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', endpoint, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(payload));
      }
    } catch (_) {}
  })();
</script>
```

---

## 2. Server Ping & TTFB Diagnostics
- **Time to First Byte (TTFB):**
  - **Optimal:** < 200 ms (Green)
  - **Acceptable:** 200 ms - 600 ms (Yellow)
  - **Critical:** > 600 ms (Red — indicates un-cached database queries or heavy backend processing)
- **HTTP Response Codes:**
  - `200 OK`: Healthy
  - `301/308 Moved Permanently`: Check redirect chains
  - `404 Not Found`: Broken links / missing pages
  - `500/502/503/504`: Backend server errors needing immediate DevOps attention

---

## 3. Scheduled Audit Routines & Executive Reporting
- **Cadence Rules:**
  - Daily scheduled audits run every morning (e.g. 09:00 AM) to evaluate the prior 24 hours.
  - Weekly audits execute every Monday for multi-week trend analysis.
- **Report Structure:**
  - Executive Brief with SEO Health Score (0-100)
  - Search Metrics Delta (Clicks, Impressions, CTR, Position)
  - Keyword Winners and Losers
  - Technical Indexing & Googlebot Crawl Warnings
  - Prioritized Action Plan (Immediate, Short-Term, Long-Term)
