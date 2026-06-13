import type { VercelRequest, VercelResponse } from '@vercel/node';

const MAX_LYRICS_LENGTH = 50_000;
const MAX_KEYWORDS = 20;
const FETCH_TIMEOUT_MS = 10_000;

type RiskLevel = 'high' | 'medium' | 'low';

type RequestSection = {
  name: string;
  text: string;
};

type CopyrightCheckRequestBody = {
  lyrics: string;
  keywords: string[];
  sections: RequestSection[];
  threshold?: number;
  limit?: number;
};

type SimilarityResult = {
  score: number;
  matchedLines: string[];
  matchedSections: Array<{ name: string; score: number }>;
  sharedWords: number;
  sharedLines: number;
  sharedKeywords: string[];
};

type CopyrightMatch = SimilarityResult & {
  title: string;
  artist: string;
  album?: string;
  year?: number;
  source: 'genius';
  copyrightHolder?: string;
  riskLevel: RiskLevel;
};

type GeniusSong = {
  url?: string;
  title?: string;
  primary_artist?: { name?: string };
  album?: { name?: string };
  release_date_components?: { year?: number };
};

type GeniusSearchResponse = {
  response?: {
    hits?: Array<{ result?: GeniusSong }>;
  };
};

function isRequestSection(value: unknown): value is RequestSection {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RequestSection).name === 'string' &&
    typeof (value as RequestSection).text === 'string'
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Internal server error';
}

/**
 * Copyright Similarity Check API
 *
 * Searches Genius for lyrics similar to the submitted text.
 * CORS is handled globally by vercel.json headers.
 *
 * Required env var: GENIUS_ACCESS_TOKEN
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    lyrics,
    keywords,
    sections = [],
    threshold = 30,
    limit = 10,
  } = (req.body ?? {}) as Partial<CopyrightCheckRequestBody>;

  if (
    typeof lyrics !== 'string' ||
    !lyrics.trim() ||
    !Array.isArray(keywords) ||
    keywords.some(keyword => typeof keyword !== 'string') ||
    !Array.isArray(sections) ||
    sections.some(section => !isRequestSection(section))
  ) {
    return res.status(400).json({ error: 'Missing lyrics or keywords' });
  }

  if (lyrics.length > MAX_LYRICS_LENGTH) {
    return res.status(400).json({ error: `Lyrics exceed maximum length of ${MAX_LYRICS_LENGTH} characters` });
  }

  if (keywords.length > MAX_KEYWORDS) {
    return res.status(400).json({ error: `Too many keywords (max ${MAX_KEYWORDS})` });
  }

  try {
    const matches: CopyrightMatch[] = [];

    // Search Genius
    if (process.env.GENIUS_ACCESS_TOKEN) {
      const geniusMatches = await searchGenius(keywords, lyrics, sections, threshold);
      matches.push(...geniusMatches);
    }

    // Deduplicate and sort
    const uniqueMatches = deduplicateMatches(matches);
    const sortedMatches = uniqueMatches
      .sort((a, b) => {
        const riskWeight = { high: 3, medium: 2, low: 1 };
        const riskDiff = riskWeight[b.riskLevel as keyof typeof riskWeight] - riskWeight[a.riskLevel as keyof typeof riskWeight];
        if (riskDiff !== 0) return riskDiff;
        return b.score - a.score;
      })
      .slice(0, limit);

    return res.status(200).json({
      matches: sortedMatches,
      count: sortedMatches.length,
      searched: matches.length,
    });
  } catch (error: unknown) {
    console.error('Copyright check error:', error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
}

/**
 * Search Genius API for similar songs
 */
async function searchGenius(
  keywords: string[],
  currentLyrics: string,
  sections: RequestSection[],
  threshold: number,
) : Promise<CopyrightMatch[]> {
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) return [];

  const matches: CopyrightMatch[] = [];

  for (const keyword of keywords.slice(0, 5)) {
    try {
      const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(keyword)}`;
      const searchController = new AbortController();
      const searchTimer = setTimeout(() => searchController.abort(), FETCH_TIMEOUT_MS);
      let searchRes: Response;
      try {
        searchRes = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${token}` },
          signal: searchController.signal,
        });
      } finally {
        clearTimeout(searchTimer);
      }

      if (!searchRes.ok) continue;

      const searchData = await searchRes.json() as GeniusSearchResponse;
      const hits = searchData.response?.hits || [];

      for (const hit of hits.slice(0, 3)) {
        const song = hit.result;
        if (!song) continue;
        if (!song.url) continue;

        try {
          const lyricsUrl = song.url;
          const lyricsController = new AbortController();
          const lyricsTimer = setTimeout(() => lyricsController.abort(), FETCH_TIMEOUT_MS);
          let lyricsRes: Response;
          try {
            lyricsRes = await fetch(lyricsUrl, { signal: lyricsController.signal });
          } finally {
            clearTimeout(lyricsTimer);
          }
          const html = await lyricsRes.text();

          const lyrics = extractLyricsFromGeniusHtml(html);
          if (!lyrics) continue;

          const similarity = calculateSimilarity(currentLyrics, lyrics, sections);

          if (similarity.score >= threshold) {
            matches.push({
              ...similarity,
              title: song.title || 'Unknown',
              artist: song.primary_artist?.name || 'Unknown',
              ...(song.album?.name !== undefined && { album: song.album.name }),
              ...(song.release_date_components?.year !== undefined && { year: song.release_date_components.year }),
              source: 'genius',
              ...(song.primary_artist?.name !== undefined && { copyrightHolder: song.primary_artist.name }),
              riskLevel: calculateRiskLevel(similarity.score),
            });
          }
        } catch (_err) {
          continue;
        }
      }
    } catch (_err) {
      continue;
    }
  }

  return matches;
}

/**
 * Extract lyrics from Genius HTML page
 */
function extractLyricsFromGeniusHtml(html: string): string | null {
  try {
    const matches = html.match(/<div[^>]*data-lyrics-container[^>]*>([\s\S]*?)<\/div>/gi);
    if (!matches) return null;

    const lyrics = matches
      .map(div => {
        return div
          .replace(/<[^>]+>/g, ' ')
          .replace(/&[a-z]+;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      })
      .join('\n\n');

    return lyrics.length > 50 ? lyrics : null;
  } catch (_err) {
    return null;
  }
}

/**
 * Calculate similarity between current lyrics and a copyrighted song
 */
function calculateSimilarity(
  currentLyrics: string,
  copyrightedLyrics: string,
  sections: RequestSection[],
): SimilarityResult {
  const currentLines = currentLyrics.split('\n').filter(l => l.trim());
  const copyrightedLines = copyrightedLyrics.split('\n').filter(l => l.trim());

  const matchedLines: string[] = [];
  currentLines.forEach(currentLine => {
    const normalized = currentLine.toLowerCase().trim();
    copyrightedLines.forEach(copyrightedLine => {
      const copyrightNormalized = copyrightedLine.toLowerCase().trim();
      if (normalized === copyrightNormalized ||
          (normalized.length > 20 && copyrightNormalized.includes(normalized)) ||
          (copyrightNormalized.length > 20 && normalized.includes(copyrightNormalized))) {
        if (!matchedLines.includes(currentLine)) {
          matchedLines.push(currentLine);
        }
      }
    });
  });

  const currentWords = new Set(
    currentLyrics.toLowerCase().match(/\b\w{4,}\b/g) || []
  );
  const copyrightedWords = new Set(
    copyrightedLyrics.toLowerCase().match(/\b\w{4,}\b/g) || []
  );
  const sharedWords = [...currentWords].filter(w => copyrightedWords.has(w)).length;

  const sharedKeywords = extractKeywords(currentLyrics).filter(keyword =>
    copyrightedLyrics.toLowerCase().includes(keyword.toLowerCase())
  );

  const matchedSections = sections
    .map((section) => {
      const sectionScore = calculateSimpleScore(section.text, copyrightedLyrics);
      return { name: section.name, score: sectionScore };
    })
    .filter(s => s.score > 20);

  const lineScore = (matchedLines.length / Math.max(currentLines.length, 1)) * 100;
  const wordScore = (sharedWords / Math.max(currentWords.size, 1)) * 100;
  const score = Math.round(lineScore * 0.7 + wordScore * 0.3);

  return {
    score,
    matchedLines,
    matchedSections,
    sharedWords,
    sharedLines: matchedLines.length,
    sharedKeywords: sharedKeywords.slice(0, 10),
  };
}

function calculateSimpleScore(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().match(/\b\w{4,}\b/g) || []);
  const words2 = new Set(text2.toLowerCase().match(/\b\w{4,}\b/g) || []);
  const shared = [...words1].filter(w => words2.has(w)).length;
  return Math.round((shared / Math.max(words1.size, 1)) * 100);
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she',
    'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
  ]);

  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const wordFreq = new Map<string, number>();

  words.forEach(word => {
    if (word.length > 3 && !stopWords.has(word)) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  });

  return Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

function calculateRiskLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function deduplicateMatches(matches: CopyrightMatch[]): CopyrightMatch[] {
  const seen = new Map<string, CopyrightMatch>();
  matches.forEach(match => {
    const key = `${match.title.toLowerCase()}-${match.artist.toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing || match.score > existing.score) {
      seen.set(key, match);
    }
  });
  return Array.from(seen.values());
}
