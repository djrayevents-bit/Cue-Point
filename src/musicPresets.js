/** Shared music presets — DJ Music tab and client portal must stay aligned. */

export const MUSIC_PRESET_GENRES = [
  "Top 40",
  "Hip-Hop / R&B",
  "Pop",
  "Rock / Classic Rock",
  "Latin / Reggaeton",
  "Country",
  "EDM / Dance",
  "Jazz",
  "Motown / Soul",
  "80s Hits",
  "90s Hits",
  "2000s Hits",
  "Caribbean / Soca",
  "Gospel / Christian",
  "Oldies",
  "Throwbacks",
  "House",
  "Afrobeats",
];

export const splitMusicList = (value) =>
  String(value || "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

export const joinMusicList = (items) => {
  const seen = new Set();
  const out = [];
  for (const raw of items || []) {
    const s = String(raw || "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.join("\n");
};

export const songRequestLabel = (song) => {
  if (!song) return "";
  if (typeof song === "string") return song.trim();
  const title = String(song.title || song.song || "").trim();
  const artist = String(song.artist || "").trim();
  if (title && artist) return `${title} — ${artist}`;
  return title || artist;
};

export const songListKey = (song) =>
  String(song?.title || song?.song || song || "")
    .trim()
    .toLowerCase();
