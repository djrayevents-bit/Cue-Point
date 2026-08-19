import React, { useRef, useState } from "react";
import { BRAND_FONT, BRAND_GRADIENT, BRAND_RADIUS, LIGHT_THEME } from "../brand";
import { supabase } from "../supabase";
import TimelineImportModal from "./TimelineImportModal";
import {
  PRESET_GENRES,
  QUICK_BLOCKS,
  applyMusicToMoment,
  hydrateRunSheet,
  newMoment,
  normalizeRunSheetMoment,
  normalizeSong,
} from "../runSheet";

const C = LIGHT_THEME;

const iStyle = {
  width: "100%",
  background: C.surfaceAlt,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "9px 12px",
  color: C.text,
  fontSize: 13,
  fontFamily: BRAND_FONT,
  outline: "none",
  boxSizing: "border-box",
};
const lStyle = {
  fontSize: 11,
  color: C.muted,
  fontWeight: 600,
  marginBottom: 5,
  display: "block",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const pillBtn = (on) => ({
  fontSize: 12,
  fontWeight: 700,
  fontFamily: BRAND_FONT,
  cursor: "pointer",
  border: `1px solid ${on ? C.accent : C.border}`,
  borderRadius: 10,
  padding: "8px 14px",
  background: on ? C.accent + "15" : C.surface,
  color: on ? C.accent : C.muted,
});

const actionBtn = (primary) => ({
  background: primary ? C.accent : "none",
  color: primary ? "#fff" : C.muted,
  border: primary ? "none" : `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "8px 14px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: BRAND_FONT,
});

async function searchSpotify(q) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
  const res = await fetch(`/api/spotify-search?q=${encodeURIComponent(q)}`, { headers });
  const data = await res.json().catch(() => ({}));
  return data.tracks || [];
}

function SpotifyPicker({ placeholder, onPick, disabled }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  const onChange = (val) => {
    setQ(val);
    clearTimeout(timer.current);
    if (!val.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      const tracks = await searchSpotify(val);
      setResults(tracks);
      setLoading(false);
    }, 400);
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        value={q}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={iStyle}
      />
      {loading && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Searching…</div>}
      {results.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          zIndex: 100, maxHeight: 220, overflowY: "auto", marginTop: 4,
        }}>
          {results.map((track, i) => (
            <div
              key={track.id || i}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(normalizeSong({
                  title: track.title,
                  artist: track.artist,
                  albumArt: track.albumArt,
                  spotifyUrl: track.spotifyUrl || track.link,
                  previewUrl: track.previewUrl,
                }));
                setQ("");
                setResults([]);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                cursor: "pointer", borderBottom: i < results.length - 1 ? `1px solid ${C.border}40` : "none",
              }}
            >
              {track.albumArt && <img src={track.albumArt} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{track.title}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{track.artist}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SongRow({ song, onRemove }) {
  if (!song?.title) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      {song.albumArt && <img src={song.albumArt} alt="" style={{ width: 24, height: 24, borderRadius: 3, objectFit: "cover" }} />}
      <div style={{ flex: 1, color: C.text }}>{song.title}{song.artist ? ` — ${song.artist}` : ""}</div>
      {onRemove && (
        <button type="button" onClick={onRemove} style={{ background: "none", border: "none", color: C.mutedLight, cursor: "pointer" }}>✕</button>
      )}
    </div>
  );
}

function parseTimeParts(time) {
  const m = String(time || "").match(/(\d+):(\d+)\s*(AM|PM)/i);
  return {
    hour: m ? m[1] : "",
    min: m ? m[2] : "00",
    ampm: m ? m[3].toUpperCase() : "PM",
  };
}

function joinTime(hour, min, ampm) {
  if (!hour) return "";
  return `${hour}:${min || "00"} ${ampm || "PM"}`;
}

/**
 * DJ editor: ordered moments. Time optional. Music is none | special | playlist.
 */
export default function RunSheetEditor({
  ev,
  moments: momentsProp,
  onChangeMoments,
  genres = [],
  onChangeGenres,
  doNotPlayItems = [],
  onChangeDoNotPlay,
  requests = [],
  onOpenCue,
  showHeader = true,
}) {
  const [editingId, setEditingId] = useState(null);
  const [buf, setBuf] = useState({});
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState("pdf");
  const [customGenre, setCustomGenre] = useState("");
  const [dnpDraft, setDnpDraft] = useState("");

  const moments = (momentsProp || []).map((m, i) => normalizeRunSheetMoment(m, i));

  const commit = (next) => onChangeMoments((next || []).map((m, i) => normalizeRunSheetMoment(m, i)));

  const startEdit = (item) => {
    const t = parseTimeParts(item.time);
    setBuf({
      timeHour: t.hour,
      timeMin: t.min,
      timeAmPm: t.ampm,
      event: item.event,
      note: item.note,
      duration: item.duration,
      musicMode: item.music.mode,
      songLimit: item.music.limit,
      playlistSongs: item.music.songs || [],
      songData: item.music.song || null,
    });
    setEditingId(item.id);
  };

  const saveEdit = (item) => {
    const mode = buf.musicMode || "none";
    let music = { mode: "none" };
    if (mode === "special") music = { mode: "special", song: buf.songData || null };
    if (mode === "playlist") {
      music = { mode: "playlist", songs: buf.playlistSongs || [], limit: buf.songLimit ?? null };
    }
    commit(moments.map((m) => String(m.id) === String(item.id)
      ? applyMusicToMoment({
        ...m,
        time: joinTime(buf.timeHour, buf.timeMin, buf.timeAmPm),
        event: buf.event || m.event,
        note: buf.note || "",
        duration: buf.duration || "",
      }, music)
      : m));
    setEditingId(null);
  };

  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= moments.length) return;
    const next = [...moments];
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next);
  };

  const addBlank = () => {
    const m = newMoment({ event: "New moment", music: { mode: "none" } });
    commit([...moments, m]);
    startEdit(m);
  };

  const addQuick = (block) => {
    if (moments.some((m) => m.event.toLowerCase() === block.label.toLowerCase())) return;
    commit([...moments, newMoment({
      event: block.label,
      note: block.note,
      music: block.mode === "special" ? { mode: "special" } : { mode: "playlist", songs: [], limit: null },
    })]);
  };

  const toggleGenre = (g) => {
    const next = genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g];
    onChangeGenres?.(next);
  };

  const timedCount = moments.filter((m) => m.time).length;
  const withMusic = moments.filter((m) => m.music.mode !== "none").length;

  return (
    <div>
      {showHeader && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>Run Sheet</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
              The night, in order. Time is optional — attach a playlist or one special song when you need it.
            </div>
            {moments.length > 0 && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                {moments.length} moment{moments.length === 1 ? "" : "s"}
                {timedCount ? ` · ${timedCount} timed` : " · no times set"}
                {withMusic ? ` · ${withMusic} with music` : ""}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => { setImportTab("pdf"); setImportOpen(true); }} style={actionBtn(false)}>Import PDF / paste</button>
            <button type="button" onClick={addBlank} style={actionBtn(true)}>+ Add moment</button>
          </div>
        </div>
      )}

      {moments.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 13, padding: "28px 16px", textAlign: "center", background: C.surfaceAlt, borderRadius: 14, border: `1px dashed ${C.border}` }}>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 8 }}>No moments yet</div>
          <div style={{ marginBottom: 16, maxWidth: 420, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
            Add timed cues, or just named playlists — Prelude, Dinner, Dancing — with no clock times.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
            <button type="button" onClick={() => { setImportTab("pdf"); setImportOpen(true); }} style={actionBtn(true)}>Import planner PDF</button>
            <button type="button" onClick={addBlank} style={actionBtn(false)}>+ Add moment</button>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Quick add</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {QUICK_BLOCKS.map((b) => (
              <button key={b.label} type="button" onClick={() => addQuick(b)} style={pillBtn(false)}>{b.label}</button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ position: "relative", paddingLeft: 4 }}>
          {moments.map((item, idx) => {
            const music = item.music;
            const isEditing = editingId === item.id;
            const playlistSongs = music.mode === "playlist" ? (music.songs || []) : [];
            const limit = music.mode === "playlist" ? music.limit : null;
            const specialSong = music.mode === "special" ? music.song : null;
            return (
              <div key={item.id || idx} style={{ display: "grid", gridTemplateColumns: "72px 28px 1fr", gap: 0, marginBottom: 14 }}>
                <div style={{ paddingTop: 14, textAlign: "right", paddingRight: 10 }}>
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 800, color: item.time ? C.accent : C.mutedLight }}>
                    {item.time || "—"}
                  </div>
                  {item.duration ? <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{item.duration}</div> : null}
                </div>
                <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                  <div style={{ position: "absolute", top: 0, bottom: idx === moments.length - 1 ? "50%" : 0, width: 2, background: C.accent + "22" }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.accent, marginTop: 20, zIndex: 1, boxShadow: `0 0 0 4px ${C.accent}18` }} />
                </div>
                <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 8 }}>
                    <button type="button" disabled={idx === 0} onClick={() => move(idx, -1)} style={{ background: "none", border: "none", color: C.muted, cursor: idx === 0 ? "default" : "pointer", fontSize: 12, opacity: idx === 0 ? 0.35 : 1 }}>↑</button>
                    <button type="button" disabled={idx === moments.length - 1} onClick={() => move(idx, 1)} style={{ background: "none", border: "none", color: C.muted, cursor: idx === moments.length - 1 ? "default" : "pointer", fontSize: 12, opacity: idx === moments.length - 1 ? 0.35 : 1 }}>↓</button>
                    <button type="button" onClick={() => startEdit(item)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, fontFamily: BRAND_FONT }}>Edit</button>
                    <button type="button" onClick={() => commit(moments.filter((m) => String(m.id) !== String(item.id)))} style={{ background: "none", border: "none", color: C.mutedLight, cursor: "pointer", fontSize: 12, fontFamily: BRAND_FONT }}>Remove</button>
                  </div>

                  {isEditing ? (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                        <div>
                          <label style={lStyle}>Time (optional)</label>
                          <div style={{ display: "flex", gap: 4 }}>
                            <select value={buf.timeHour || ""} onChange={(e) => setBuf((p) => ({ ...p, timeHour: e.target.value }))} style={{ ...iStyle, flex: 1 }}>
                              <option value="">—</option>
                              {["1","2","3","4","5","6","7","8","9","10","11","12"].map((h) => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <select value={buf.timeMin || "00"} onChange={(e) => setBuf((p) => ({ ...p, timeMin: e.target.value }))} style={{ ...iStyle, flex: 1 }}>
                              {["00","05","10","15","20","25","30","35","40","45","50","55"].map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <select value={buf.timeAmPm || "PM"} onChange={(e) => setBuf((p) => ({ ...p, timeAmPm: e.target.value }))} style={{ ...iStyle, flex: 1 }}>
                              <option value="AM">AM</option>
                              <option value="PM">PM</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label style={lStyle}>Moment</label>
                          <input value={buf.event || ""} onChange={(e) => setBuf((p) => ({ ...p, event: e.target.value }))} style={iStyle} />
                        </div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={lStyle}>What happens here</label>
                        <input value={buf.note || ""} onChange={(e) => setBuf((p) => ({ ...p, note: e.target.value }))} placeholder="Announce names, cue lighting…" style={iStyle} />
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                        {[
                          { id: "playlist", label: "Playlist" },
                          { id: "special", label: "Special song" },
                        ].map((opt) => {
                          const on = (buf.musicMode || "none") === opt.id;
                          return (
                            <button key={opt.id} type="button" onClick={() => setBuf((p) => ({
                              ...p,
                              musicMode: p.musicMode === opt.id ? "none" : opt.id,
                              songData: opt.id === "special" ? (p.songData || specialSong) : null,
                            }))} style={pillBtn(on)}>{opt.label}</button>
                          );
                        })}
                      </div>

                      {(buf.musicMode || "none") === "special" && (
                        <div style={{ marginBottom: 10 }}>
                          {buf.songData?.title ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}` }}>
                              {buf.songData.albumArt && <img src={buf.songData.albumArt} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover" }} />}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{buf.songData.title}</div>
                                <div style={{ fontSize: 12, color: C.muted }}>{buf.songData.artist}</div>
                              </div>
                              <button type="button" onClick={() => setBuf((p) => ({ ...p, songData: null }))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: BRAND_FONT, fontSize: 12 }}>Clear</button>
                            </div>
                          ) : (
                            <>
                              <label style={lStyle}>Pick 1 song</label>
                              <SpotifyPicker placeholder="Search Spotify…" onPick={(song) => setBuf((p) => ({ ...p, musicMode: "special", songData: song }))} />
                            </>
                          )}
                        </div>
                      )}

                      {(buf.musicMode || "none") === "playlist" && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.muted, fontWeight: 600, fontFamily: BRAND_FONT }}>
                              Song limit
                              <input
                                type="number"
                                min={1}
                                placeholder="None"
                                value={buf.songLimit == null ? "" : buf.songLimit}
                                onChange={(e) => {
                                  const v = e.target.value.trim();
                                  setBuf((p) => ({ ...p, songLimit: v === "" ? null : Math.max(1, Number(v) || 1) }));
                                }}
                                style={{ ...iStyle, width: 88 }}
                              />
                            </label>
                            {buf.songLimit != null && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: (buf.playlistSongs || []).length >= buf.songLimit ? "#DC2626" : C.muted }}>
                                {(buf.playlistSongs || []).length}/{buf.songLimit}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                            {(buf.playlistSongs || []).map((t, ti) => (
                              <SongRow key={ti} song={t} onRemove={() => setBuf((p) => ({
                                ...p,
                                playlistSongs: (p.playlistSongs || []).filter((_, i) => i !== ti),
                              }))} />
                            ))}
                          </div>
                          {buf.songLimit != null && (buf.playlistSongs || []).length >= buf.songLimit ? (
                            <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>Playlist limit reached.</div>
                          ) : (
                            <SpotifyPicker
                              placeholder="Search Spotify to add a song…"
                              onPick={(song) => setBuf((p) => ({
                                ...p,
                                musicMode: "playlist",
                                playlistSongs: [...(p.playlistSongs || []), song],
                              }))}
                            />
                          )}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => saveEdit(item)} style={actionBtn(true)}>Save</button>
                        <button type="button" onClick={() => setEditingId(null)} style={actionBtn(false)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 4 }}>{item.event}</div>
                      {item.note && <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>{item.note}</div>}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {music.mode === "playlist" && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: C.accent + "15", padding: "4px 10px", borderRadius: 999 }}>
                            Playlist{limit != null ? ` · ${playlistSongs.length}/${limit}` : ` · ${playlistSongs.length} song${playlistSongs.length === 1 ? "" : "s"}`}
                          </span>
                        )}
                        {music.mode === "special" && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: C.accent + "15", padding: "4px 10px", borderRadius: 999 }}>
                            Special song{specialSong?.title ? ` · ${specialSong.title}` : " · pick a song"}
                          </span>
                        )}
                        {music.mode === "none" && (
                          <span style={{ fontSize: 11, color: C.muted }}>No music attached</span>
                        )}
                      </div>
                      {music.mode === "special" && specialSong?.title && (
                        <div style={{ marginTop: 8 }}><SongRow song={specialSong} /></div>
                      )}
                      {music.mode === "playlist" && playlistSongs.length > 0 && (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                          {playlistSongs.slice(0, 4).map((t, ti) => (
                            <div key={ti} style={{ fontSize: 12, color: C.muted }}>{t.title}{t.artist ? ` — ${t.artist}` : ""}</div>
                          ))}
                          {playlistSongs.length > 4 && <div style={{ fontSize: 11, color: C.mutedLight }}>+{playlistSongs.length - 4} more</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "4px 0 8px 100px" }}>
            {QUICK_BLOCKS.filter((b) => !moments.some((m) => m.event.toLowerCase() === b.label.toLowerCase())).slice(0, 4).map((b) => (
              <button key={b.label} type="button" onClick={() => addQuick(b)} style={{ ...pillBtn(false), padding: "6px 12px" }}>+ {b.label}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: BRAND_GRADIENT, borderRadius: 14, padding: "22px 20px", color: "#fff", marginTop: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Plan this with CUE</div>
        <div style={{ fontSize: 13, opacity: 0.92, lineHeight: 1.6, marginBottom: 14 }}>
          Generate a run-of-show, or import a planner PDF / pasted schedule.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" onClick={() => onOpenCue?.(ev?.id, { intent: "timeline" })} style={{ background: "#fff", color: C.accent, border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>Generate timeline →</button>
          <button type="button" onClick={() => { setImportTab("pdf"); setImportOpen(true); }} style={{ background: "rgba(255,255,255,0.18)", color: "#fff", border: "1px solid rgba(255,255,255,0.45)", borderRadius: 10, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>Import PDF / paste →</button>
        </div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 16px", marginTop: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Music wishes</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Genres and skip lists for the whole night — not tied to a clock.</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>Genres</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {PRESET_GENRES.map((g) => {
            const on = genres.includes(g);
            return (
              <button key={g} type="button" onClick={() => toggleGenre(g)} style={{
                fontSize: 12, fontWeight: 600, fontFamily: BRAND_FONT, cursor: "pointer",
                border: `1px solid ${on ? C.accent : C.border}`, borderRadius: 999,
                padding: "6px 12px", background: on ? C.accent + "15" : C.surfaceAlt, color: on ? C.accent : C.muted,
              }}>{g}</button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={customGenre} onChange={(e) => setCustomGenre(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter" && customGenre.trim()) {
              if (!genres.includes(customGenre.trim())) onChangeGenres?.([...genres, customGenre.trim()]);
              setCustomGenre("");
            }
          }} placeholder="Custom genre" style={{ ...iStyle, flex: 1 }} />
          <button type="button" onClick={() => {
            const g = customGenre.trim();
            if (g && !genres.includes(g)) onChangeGenres?.([...genres, g]);
            setCustomGenre("");
          }} style={actionBtn(false)}>Add</button>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>Do not play</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {doNotPlayItems.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${C.border}40` }}>
              <span>{item}</span>
              <button type="button" onClick={() => onChangeDoNotPlay?.(doNotPlayItems.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: C.mutedLight, cursor: "pointer" }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={dnpDraft} onChange={(e) => setDnpDraft(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter" && dnpDraft.trim()) {
              onChangeDoNotPlay?.([...doNotPlayItems, dnpDraft.trim()]);
              setDnpDraft("");
            }
          }} placeholder="Song or artist to skip" style={{ ...iStyle, flex: 1 }} />
          <button type="button" onClick={() => {
            if (!dnpDraft.trim()) return;
            onChangeDoNotPlay?.([...doNotPlayItems, dnpDraft.trim()]);
            setDnpDraft("");
          }} style={actionBtn(false)}>Add</button>
        </div>
        {requests.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>From the client portal</div>
            {requests.map((r) => (
              <div key={r.id} style={{ fontSize: 13, padding: "6px 0", color: C.text }}>
                <span style={{ fontWeight: 700, color: /do.?not|skip/i.test(String(r.type)) ? "#DC2626" : "#16A34A", marginRight: 8 }}>
                  {/do.?not|skip/i.test(String(r.type)) ? "SKIP" : "MUST"}
                </span>
                {r.song || r.title}{r.artist ? ` — ${r.artist}` : ""}
              </div>
            ))}
          </div>
        )}
      </div>

      {importOpen && (
        <TimelineImportModal
          event={ev}
          existingCount={moments.length}
          initialTab={importTab}
          onClose={() => setImportOpen(false)}
          onToast={() => {}}
          onApply={({ items, mode }) => {
            const incoming = (items || []).map((it, i) => normalizeRunSheetMoment(it, i));
            commit(mode === "merge" ? [...moments, ...incoming] : incoming);
            setImportOpen(false);
            return true;
          }}
          onRequestMcScripts={() => onOpenCue?.(ev?.id, { intent: "mc_scripts" })}
        />
      )}
    </div>
  );
}

export function useHydratedRunSheet(rawMoments, sections) {
  const key = `${(rawMoments || []).length}:${(sections || []).length}:${(rawMoments || []).map((m) => m.id).join(",")}`;
  return React.useMemo(
    () => hydrateRunSheet(rawMoments, sections),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );
}
