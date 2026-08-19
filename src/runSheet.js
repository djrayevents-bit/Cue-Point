/**
 * Run sheet = one ordered list of moments.
 * Music is a field on a moment (none | special | playlist). Time is optional.
 */

export const PRESET_GENRES = [
  "Top 40", "Hip-Hop / R&B", "Pop", "Rock / Classic Rock", "Latin / Reggaeton",
  "Country", "EDM / Dance", "Jazz", "Motown / Soul", "80s Hits", "90s Hits",
  "2000s Hits", "Caribbean / Soca", "Gospel / Christian", "Oldies",
];

export const QUICK_BLOCKS = [
  { label: "Prelude", note: "Background as people arrive", mode: "playlist" },
  { label: "Cocktail Hour", note: "Light background while guests mingle", mode: "playlist" },
  { label: "Dinner", note: "Easy, conversational", mode: "playlist" },
  { label: "Dancing", note: "Peak energy", mode: "playlist" },
  { label: "Grand Entrance", note: "Announce the couple / party", mode: "special" },
  { label: "First Dance", note: "Spotlight, then invite the floor", mode: "special" },
  { label: "Last Dance", note: "Close the night", mode: "special" },
];

export const normalizeSong = (song) => {
  if (!song || typeof song !== "object") return null;
  const title = String(song.title || song.song || "").trim();
  const artist = String(song.artist || "").trim();
  if (!title && !artist) return null;
  return {
    id: song.id || undefined,
    title: title || artist,
    artist,
    albumArt: song.albumArt || "",
    spotifyUrl: song.spotifyUrl || song.link || "",
    link: song.link || song.spotifyUrl || "",
    previewUrl: song.previewUrl || "",
    duration: song.duration || "",
    durationMs: song.durationMs || undefined,
    bpm: song.bpm || "",
  };
};

const songLabel = (song) => {
  const s = normalizeSong(song);
  if (!s) return "";
  return [s.title, s.artist].filter(Boolean).join(" — ");
};

export const normalizeMomentMusic = (music) => {
  if (!music || music.mode === "none" || music.mode == null) {
    return { mode: "none", song: null, songs: [], limit: null };
  }
  if (music.mode === "special") {
    return {
      mode: "special",
      song: normalizeSong(music.song) || null,
      songs: [],
      limit: 1,
    };
  }
  const limitRaw = music.limit ?? music.songLimit;
  const limit = limitRaw === "" || limitRaw == null ? null : Math.max(1, Number(limitRaw) || 0) || null;
  const songs = Array.isArray(music.songs)
    ? music.songs.map(normalizeSong).filter(Boolean)
    : [];
  return { mode: "playlist", song: null, songs, limit };
};

export const musicFromSection = (sec) => {
  if (!sec) return normalizeMomentMusic({ mode: "none" });
  if (sec.type === "special" || sec.song) {
    return normalizeMomentMusic({ mode: "special", song: sec.song || null });
  }
  return normalizeMomentMusic({
    mode: "playlist",
    songs: sec.songs || [],
    limit: sec.songLimit ?? sec.limit ?? null,
  });
};

const blankMusic = () => normalizeMomentMusic({ mode: "none" });

/** Infer music already stored on a timeline item (several legacy shapes). */
export const momentMusicFromItem = (item, sections = []) => {
  if (!item) return blankMusic();
  if (item.music && typeof item.music === "object" && item.music.mode) {
    const nested = normalizeMomentMusic(item.music);
    if (nested.mode !== "none") return nested;
  }
  const mode = item.musicMode;
  if (mode === "special") {
    return normalizeMomentMusic({ mode: "special", song: item.songData || null });
  }
  if (mode === "playlist") {
    return normalizeMomentMusic({
      mode: "playlist",
      songs: item.playlistSongs || [],
      limit: item.songLimit ?? null,
    });
  }
  if (mode === "none") return blankMusic();

  const sec = item.linkedSectionId
    ? (sections || []).find((s) => String(s.id) === String(item.linkedSectionId))
    : null;
  if (sec) return musicFromSection(sec);
  return blankMusic();
};

export const displayLabel = (item) => String(item?.event || item?.label || "").trim();

const displaySongString = (music) => {
  if (music.mode === "special") return songLabel(music.song);
  if (music.mode === "playlist") {
    const n = (music.songs || []).length;
    return n ? `${n} song${n === 1 ? "" : "s"}` : "";
  }
  return "";
};

export const normalizeRunSheetMoment = (item, idx = 0, sections = []) => {
  const label = displayLabel(item);
  const music = momentMusicFromItem(item, sections);
  const id = item?.id != null ? item.id : `m-${idx}-${Date.now().toString(36).slice(-4)}`;
  return {
    id,
    time: item?.time || "",
    duration: item?.duration != null && item.duration !== "" ? String(item.duration) : "",
    event: label,
    label,
    note: item?.note || item?.desc || "",
    tag: item?.tag || "",
    song: displaySongString(music) || item?.song || "",
    music,
    musicMode: music.mode,
    songData: music.mode === "special" ? music.song : null,
    playlistSongs: music.mode === "playlist" ? music.songs : [],
    songLimit: music.mode === "playlist" ? music.limit : null,
    linkedSectionId: music.mode === "none" ? null : (item?.linkedSectionId || `sec_rs_${id}`),
  };
};

export const deriveMusicSections = (moments) =>
  (moments || [])
    .map((raw) => normalizeRunSheetMoment(raw))
    .filter((m) => m.music.mode !== "none")
    .map((m) => {
      const secId = m.linkedSectionId || `sec_rs_${m.id}`;
      if (m.music.mode === "special") {
        return {
          id: secId,
          name: m.event,
          type: "special",
          song: m.music.song || null,
          startTime: m.time || "",
          endTime: "",
          linkedMomentId: m.id,
          sourceLimit: 1,
        };
      }
      return {
        id: secId,
        name: m.event,
        type: "playlist",
        songs: m.music.songs || [],
        startTime: m.time || "",
        linkedMomentId: m.id,
        songLimit: m.music.limit,
      };
    });

const namesMatch = (a, b) =>
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/**
 * Merge leftover music.sections onto moments. Unlinked sections become
 * untimed moments so prelude/dinner/dance blocks are not lost.
 */
export const hydrateRunSheet = (moments, sections = []) => {
  const secs = Array.isArray(sections) ? sections.filter(Boolean) : [];
  const list = Array.isArray(moments) ? moments : [];
  const used = new Set();

  const takeSection = (sec) => {
    if (!sec) return null;
    used.add(String(sec.id));
    return sec;
  };

  const next = list.map((item, idx) => {
    let music = momentMusicFromItem(item, secs);
    if (music.mode === "none") {
      const byLink = item.linkedSectionId
        ? secs.find((s) => String(s.id) === String(item.linkedSectionId))
        : null;
      const byMoment = secs.find((s) => String(s.linkedMomentId) === String(item.id));
      const byName = secs.find((s) => namesMatch(s.name, displayLabel(item)));
      const sec = byLink || byMoment || byName;
      if (sec) {
        takeSection(sec);
        music = musicFromSection(sec);
      }
    } else if (item.linkedSectionId) {
      takeSection(secs.find((s) => String(s.id) === String(item.linkedSectionId)));
    }
    return normalizeRunSheetMoment({ ...item, music, musicMode: music.mode }, idx);
  });

  const leftovers = secs.filter((s) => !used.has(String(s.id)));
  const extra = leftovers.map((sec, i) =>
    normalizeRunSheetMoment({
      id: `fromsec_${sec.id || i}`,
      time: sec.startTime || "",
      event: sec.name || "Playlist",
      label: sec.name || "Playlist",
      note: sec.notes || "",
      music: musicFromSection(sec),
      linkedSectionId: sec.id,
    }, list.length + i)
  );

  const didMigrate = extra.length > 0 || next.some((m, i) => {
    const prev = momentMusicFromItem(list[i], []);
    return prev.mode === "none" && m.music.mode !== "none";
  });

  return { moments: [...next, ...extra], didMigrate };
};

export const momentsFromMusicSections = (sections = []) =>
  (sections || []).map((sec, i) =>
    normalizeRunSheetMoment({
      id: Date.now() + i,
      time: sec.startTime || "",
      duration: sec.duration || "",
      event: sec.name || "Playlist",
      note: sec.notes || "",
      music: musicFromSection(
        sec.type === "special" || sec.type === "playlist"
          ? sec
          : { ...sec, type: /first dance|grand entrance|last (dance|song)|cake/i.test(sec.name || "") ? "special" : "playlist" }
      ),
    }, i)
  );

export const applyMusicToMoment = (moment, music) =>
  normalizeRunSheetMoment({ ...moment, music: normalizeMomentMusic(music) });

export const newMoment = (partial = {}) =>
  normalizeRunSheetMoment({
    id: Date.now() + Math.floor(Math.random() * 1000),
    time: "",
    duration: "",
    event: "",
    note: "",
    music: { mode: "none" },
    ...partial,
  });

export const countSpecialOpen = (moments) =>
  (moments || []).filter((m) => {
    const music = normalizeRunSheetMoment(m).music;
    return music.mode === "special" && !music.song?.title;
  }).length;

export const countMusicFilled = (moments) =>
  (moments || []).filter((m) => {
    const music = normalizeRunSheetMoment(m).music;
    if (music.mode === "special") return !!music.song?.title;
    if (music.mode === "playlist") return (music.songs || []).length > 0;
    return false;
  }).length;

export const splitDoNotPlay = (raw) =>
  String(raw || "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
