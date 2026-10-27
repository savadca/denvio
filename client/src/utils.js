export function parseDate(value) {
  if (!value) return null;
  // SQLite datetime('now') is UTC without a zone marker.
  return new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
}

export function timeAgo(value) {
  const d = parseDate(value);
  if (!d) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const units = [['y', 31536000], ['w', 604800], ['d', 86400], ['h', 3600], ['m', 60]];
  for (const [label, secs] of units) if (s >= secs) return `${Math.floor(s / secs)}${label}`;
  return 'just now';
}

export function initials(subject) {
  const words = subject.replace(/&/g, '').split(/\s+/).filter((w) => w.length > 2 && !['General', 'and'].includes(w));
  return (words[0] || subject).slice(0, 7);
}

export function fileKind(mime = '') {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.includes('word')) return 'DOC';
  if (mime.includes('powerpoint') || mime.includes('presentation')) return 'PPT';
  if (mime.startsWith('text/')) return 'TXT';
  return 'FILE';
}

function safeUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function youtubeId(u) {
  const host = u.hostname.replace(/^(www|m)\./, '');
  if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0];
  if (host.endsWith('youtube.com')) {
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]+)/);
    if (m) return m[2];
  }
  return null;
}

// Turns a pasted link into something we can embed: iframe, <video>/<audio>, or a plain link.
export function mediaEmbed(url, kind) {
  const u = safeUrl(url);
  if (!u) return null;
  const host = u.hostname.replace(/^(www|m)\./, '');
  const yt = youtubeId(u);
  if (yt) return { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${yt}` };
  if (host === 'vimeo.com') {
    const id = u.pathname.split('/').find((p) => /^\d+$/.test(p));
    if (id) return { type: 'iframe', src: `https://player.vimeo.com/video/${id}` };
  }
  const drive = host === 'drive.google.com' && u.pathname.match(/\/file\/d\/([\w-]+)/);
  if (drive) return { type: 'iframe', src: `https://drive.google.com/file/d/${drive[1]}/preview`, short: kind === 'audio' };
  if (host === 'open.spotify.com') return { type: 'iframe', src: `https://open.spotify.com/embed${u.pathname}`, short: true };
  if (host === 'soundcloud.com') {
    return { type: 'iframe', src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}`, short: true };
  }
  if (/\.(mp4|webm|mov|m4v)$/i.test(u.pathname)) return { type: 'video', src: url };
  if (/\.(mp3|wav|ogg|m4a|aac|oga)$/i.test(u.pathname)) return { type: 'audio', src: url };
  return { type: 'link', src: url };
}

// Each subject gets its own stable colour (hue) for tiles, pills and dots.
const HUES = [262, 330, 18, 200, 158, 42, 290, 350, 186, 222, 128, 8, 305, 172, 240, 28, 345, 210, 95];
export function subjectHue(subject = '') {
  let h = 0;
  for (let i = 0; i < subject.length; i++) h = (h * 31 + subject.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// "5m ago", but plain "just now" (never "just now ago").
export function ago(value) {
  const t = timeAgo(value);
  return t === 'just now' ? t : `${t} ago`;
}

const SUBJECT_EMOJI = {
  'General Anatomy': '🦴', 'General Physiology': '🫀', Biochemistry: '🧪', 'Dental Anatomy & Histology': '🦷',
  'Dental Materials': '⚗️', 'General Pathology': '🔬', Microbiology: '🦠', Pharmacology: '💊',
  'General Medicine': '🩺', 'General Surgery': '🏥', 'Oral Pathology': '🧫', 'Oral Medicine & Radiology': '☢️',
  'Oral & Maxillofacial Surgery': '😷', Prosthodontics: '😁', 'Conservative Dentistry & Endodontics': '🛠️',
  Orthodontics: '😬', Periodontics: '🌿', Pedodontics: '👶', 'Public Health Dentistry': '🌍',
  'NEET MDS': '🎯', 'INI-CET (AIIMS)': '🏛️', 'ORE – UK': '🇬🇧', 'ADC – Australia': '🇦🇺',
  'NDEB – Canada': '🇨🇦', 'INBDE – USA': '🇺🇸', 'Gulf – DHA / MOH': '🇦🇪',
};

// One-line blurbs for the exam-prep cards.
export const EXAM_INFO = {
  'NEET MDS': 'MDS entrance · India',
  'INI-CET (AIIMS)': 'AIIMS, PGIMER, JIPMER · India',
  'ORE – UK': 'Overseas Registration Exam',
  'ADC – Australia': 'Australian Dental Council',
  'NDEB – Canada': 'AFK · ACJ · NDECC',
  'INBDE – USA': 'Integrated National Board',
  'Gulf – DHA / MOH': 'Dubai · UAE · Saudi · Qatar',
};
export const subjectEmoji = (subject) => SUBJECT_EMOJI[subject] || '📘';

export const REGIONS = [
  { id: 'india', label: 'India', flag: '🇮🇳' },
  { id: 'uk', label: 'UK', flag: '🇬🇧' },
  { id: 'australia', label: 'Australia', flag: '🇦🇺' },
  { id: 'canada', label: 'Canada', flag: '🇨🇦' },
  { id: 'usa', label: 'USA', flag: '🇺🇸' },
  { id: 'gulf', label: 'Gulf (UAE, Saudi, Qatar)', flag: '🇦🇪' },
  { id: 'other', label: 'Other', flag: '🌍' },
];
export const regionInfo = (id) => REGIONS.find((r) => r.id === id) || REGIONS[REGIONS.length - 1];

export const NOTICE_CATEGORIES = [
  { id: 'exam', label: 'Exam', emoji: '📝' },
  { id: 'admission', label: 'Admission / Counselling', emoji: '🎓' },
  { id: 'result', label: 'Result', emoji: '📊' },
  { id: 'recruitment', label: 'Recruitment', emoji: '💼' },
  { id: 'regulatory', label: 'Council / Regulatory', emoji: '⚖️' },
  { id: 'other', label: 'Other', emoji: '📌' },
];

// Which region each exam belongs to (Exam Prep → Notifications tab).
export const EXAM_REGION = {
  'NEET MDS': 'india', 'INI-CET (AIIMS)': 'india', 'ORE – UK': 'uk', 'ADC – Australia': 'australia',
  'NDEB – Canada': 'canada', 'INBDE – USA': 'usa', 'Gulf – DHA / MOH': 'gulf',
};

// Official bodies students should check; homepages only, so links don't go stale.
export const OFFICIAL_SOURCES = {
  india: [
    { name: 'NBEMS — NEET MDS', url: 'https://natboard.edu.in' },
    { name: 'AIIMS Exams — INI-CET', url: 'https://www.aiimsexams.ac.in' },
    { name: 'MCC — MDS counselling', url: 'https://mcc.nic.in' },
    { name: 'Dental Council of India', url: 'https://dciindia.gov.in' },
  ],
  uk: [{ name: 'General Dental Council — ORE', url: 'https://www.gdc-uk.org' }],
  australia: [{ name: 'Australian Dental Council', url: 'https://adc.org.au' }],
  canada: [{ name: 'NDEB — National Dental Examining Board', url: 'https://ndeb-bned.ca' }],
  usa: [{ name: 'JCNDE — INBDE', url: 'https://jcnde.ada.org' }],
  gulf: [
    { name: 'Dubai Health Authority', url: 'https://www.dha.gov.ae' },
    { name: 'UAE Ministry of Health (MOHAP)', url: 'https://mohap.gov.ae' },
    { name: 'Saudi Commission for Health Specialties', url: 'https://scfhs.org.sa' },
    { name: 'Qatar Ministry of Public Health', url: 'https://www.moph.gov.qa' },
  ],
};

// "Closes in 5 days" / "Closes today" / "Closed" for a YYYY-MM-DD deadline.
export function deadlineStatus(date) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${date}T00:00:00`);
  const days = Math.round((d - today) / 86400000);
  if (days < 0) return { text: 'Closed', tone: 'closed' };
  if (days === 0) return { text: 'Closes today', tone: 'urgent' };
  if (days <= 7) return { text: `Closes in ${days} day${days > 1 ? 's' : ''}`, tone: 'urgent' };
  return { text: `${days} days left`, tone: 'open' };
}

export function formatDate(date) {
  if (!date) return '';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
