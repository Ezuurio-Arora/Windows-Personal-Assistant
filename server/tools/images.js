import fs from 'fs';
import path from 'path';
import os from 'os';

const MEDIA_DIR = path.join(os.tmpdir(), 'assistant_media');

// Ensure cache directory exists
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

/**
 * Clean query string for search
 */
function sanitizeSearchQuery(query) {
  return (query || '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch a high-quality relevant image for a topic or slide.
 * Caches images locally in %TEMP%/assistant_media and returns the absolute file path.
 */
export async function fetchTopicImage(query) {
  const clean = sanitizeSearchQuery(query);
  if (!clean || clean.length < 2) return null;

  const safeFilename = `${clean.replace(/\s+/g, '_').toLowerCase().substring(0, 35)}_${Date.now()}.jpg`;
  const targetPath = path.join(MEDIA_DIR, safeFilename);

  // 1. Try Wikimedia Commons search
  try {
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(clean)}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|mime|size&format=json`;
    const res = await fetch(commonsUrl, {
      headers: { 'User-Agent': 'PersonalAssistant/2.0 (education-bot@assistant.local)' },
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const data = await res.json();
      const pages = data.query?.pages || {};
      for (const key of Object.keys(pages)) {
        const info = pages[key].imageinfo?.[0];
        if (info && (info.mime === 'image/jpeg' || info.mime === 'image/png')) {
          // Verify it's a good photographic size, avoid tiny icons or huge 50MB files
          if (info.size && (info.size < 50000 || info.size > 15000000)) continue;
          const imgUrl = info.url;
          if (imgUrl) {
            const imgRes = await fetch(imgUrl, {
              headers: { 'User-Agent': 'PersonalAssistant/2.0' },
              signal: AbortSignal.timeout(8000)
            });
            if (imgRes.ok) {
              const buffer = Buffer.from(await imgRes.arrayBuffer());
              if (buffer.length > 5000) {
                fs.writeFileSync(targetPath, buffer);
                return targetPath;
              }
            }
          }
        }
      }
    }
  } catch (err) {
    // Fall through to fallback
  }

  // 2. Fallback: Unsplash direct high-res photo search
  try {
    const unsplashUrl = `https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80`; // generic fallback
    // Or topic-targeted public photos
    const topicKeywords = clean.toLowerCase();
    let fallbackUrl = 'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=800&q=80'; // tech / nature
    if (topicKeywords.includes('solar') || topicKeywords.includes('sun')) {
      fallbackUrl = 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80';
    } else if (topicKeywords.includes('wind') || topicKeywords.includes('turbine')) {
      fallbackUrl = 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=800&q=80';
    } else if (topicKeywords.includes('energy') || topicKeywords.includes('power') || topicKeywords.includes('green')) {
      fallbackUrl = 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80';
    } else if (topicKeywords.includes('ai') || topicKeywords.includes('data') || topicKeywords.includes('tech')) {
      fallbackUrl = 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80';
    } else if (topicKeywords.includes('money') || topicKeywords.includes('finance') || topicKeywords.includes('market') || topicKeywords.includes('business')) {
      fallbackUrl = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80';
    }

    const fbRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(6000) });
    if (fbRes.ok) {
      const buffer = Buffer.from(await fbRes.arrayBuffer());
      fs.writeFileSync(targetPath, buffer);
      return targetPath;
    }
  } catch (err) {
    // If offline or network fails, return null gracefully
  }

  return null;
}
