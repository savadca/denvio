const express = require('express');

const router = express.Router();

// Public dentistry RSS feeds. Each item links back to the publisher's own article.
const SOURCES = [
  { id: 'sciencedaily', name: 'ScienceDaily', category: 'research', url: 'https://www.sciencedaily.com/rss/health_medicine/dentistry.xml' },
  { id: 'newsmedical', name: 'News-Medical', category: 'health', url: 'https://www.news-medical.net/tag/feed/Dentistry.aspx' },
  { id: 'dentistryuk', name: 'Dentistry.co.uk', category: 'practice', url: 'https://www.dentistry.co.uk/feed/' },
];
const CACHE_MS = 30 * 60 * 1000;
let cache = { at: 0, items: [], errors: [] };
let inflight = null;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    });
}
const stripTags = (s) => decode(decode(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
}

function parseFeed(xml, source) {
  const items = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const raw = m[0];
    const title = stripTags(tag(raw, 'title'));
    const link = decode(tag(raw, 'link')).trim() || (raw.match(/<item[^>]*rdf:about="([^"]+)"/i) || [])[1];
    if (!title || !/^https?:\/\//.test(link || '')) continue;
    const dateText = tag(raw, 'pubDate') || tag(raw, 'dc:date');
    const date = new Date(decode(dateText).trim());
    const image = (raw.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i) || raw.match(/<enclosure[^>]*url="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i)
      || decode(tag(raw, 'description')).match(/<img[^>]*src="([^"]+)"/i) || [])[1] || '';
    items.push({
      id: `${source.id}:${link}`,
      title,
      summary: stripTags(tag(raw, 'description')).slice(0, 280),
      link,
      image: /^https:\/\//.test(image) ? image : '',
      date: isNaN(date) ? null : date.toISOString(),
      source: source.name,
      category: source.category,
    });
  }
  return items.slice(0, 25);
}

async function refresh() {
  const results = await Promise.allSettled(SOURCES.map(async (s) => {
    const r = await fetch(s.url, { headers: { 'User-Agent': 'Denvio/1.0 (student news reader)' }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`${s.name}: HTTP ${r.status}`);
    const xml = await r.text();
    if (!/<(rss|rdf:RDF|feed)[\s>]/.test(xml)) throw new Error(`${s.name}: not a feed`);
    return parseFeed(xml, s);
  }));
  const items = [];
  const errors = [];
  results.forEach((r, i) => (r.status === 'fulfilled' ? items.push(...r.value) : errors.push(SOURCES[i].name)));
  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  // Keep the old cache if every source failed (e.g. offline), so the page isn't emptied.
  if (items.length || !cache.items.length) cache = { at: Date.now(), items, errors };
  return cache;
}

router.get('/news', async (req, res) => {
  if (Date.now() - cache.at > CACHE_MS) {
    inflight = inflight || refresh().finally(() => { inflight = null; });
    await inflight;
  }
  let items = cache.items;
  if (req.query.category) items = items.filter((i) => i.category === req.query.category);
  if (req.query.q) {
    const q = String(req.query.q).toLowerCase();
    items = items.filter((i) => i.title.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q));
  }
  res.json({
    items: items.slice(0, Number(req.query.limit) || 80),
    sources: SOURCES.map(({ name, category }) => ({ name, category })),
    unavailable: cache.errors,
    updated_at: new Date(cache.at).toISOString(),
  });
});

module.exports = router;
