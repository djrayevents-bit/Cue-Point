import React, { useRef, useState } from "react";
import { BRAND_FONT, LIGHT_THEME } from "../brand";
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

function OptionalTime({ value, onChange }) {
  const t = parseTimeParts(value);
  const [open, setOpen] = useState(!!value);
  if (!open && !value) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{
        background: "none", border: "none", color: C.muted, cursor: "pointer",
        fontSize: 12, fontWeight: 600, fontFamily: BRAND_FONT, padding: 0,
      }}>+ Time</button>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <select value={t.hour} onChange={(e) => onChange(joinTime(e.target.value, t.min, t.ampm))} style={{ ...iStyle, width: 64, padding: "6px 8px" }}>
        <option value="">Off</option>
        {["1","2","3","4","5","6","7","8","9","10","11","12"].map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <select value={t.min} onChange={(e) => onChange(joinTime(t.hour || "6", e.target.value, t.ampm))} style={{ ...iStyle, width: 64, padding: "6px 8px" }}>
        {["00","05","10","15","20","25","30","35","40","45","50","55"].map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <select value={t.ampm} onChange={(e) => onChange(joinTime(t.hour || "6", t.min, e.target.value))} style={{ ...iStyle, width: 64, padding: "6px 8px" }}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
      <button type="button" onClick={() => { onChange(""); setOpen(false); }} style={{
        background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, fontFamily: BRAND_FONT,
      }}>Clear</button>
    </div>
  );
}

/**
 * DJ editor: ordered moments. Time optional. Music is none | special | playlist.
 * Edits save as you type — no Edit / Save / Cancel form.
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
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState("pdf");
  const [customGenre, setCustomGenre] = useState("");
  const [dnpDraft, setDnpDraft] = useState("");
  const [showWishes, setShowWishes] = useState(false);
  const titleRefs = useRef({});

  const moments = (momentsProp || []).map((m, i) => normalizeRunSheetMoment(m, i));
  const commit = (next) => onChangeMoments((next || []).map((m, i) => normalizeRunSheetMoment(m, i)));
  const patch = (id, partial, music) => {
    commit(moments.map((m) => {
      if (String(m.id) !== String(id)) return m;
      const next = { ...m, ...partial };
      return applyMusicToMoment(next, music || next.music);
    }));
  };

  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= moments.length) return;
    const next = [...moments];
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next);
  };

  const addBlank = () => {
    const m = newMoment({ event: "", note: "", music: { mode: "none" } });
    commit([...moments, m]);
    setTimeout(() => titleRefs.current[m.id]?.focus(), 50);
  };

  const addQuick = (block) => {
    if (moments.some((m) => (m.event || "").toLowerCase() === block.label.toLowerCase())) return;
    commit([...moments, newMoment({
      event: block.label,
      note: block.note,
      music: block.mode === "special" ? { mode: "special" } : { mode: "playlist", songs: [], limit: null },
    })]);
  };

  const setMode = (item, mode) => {
    if (item.music.mode === mode) {
      patch(item.id, {}, { mode: "none" });
      return;
    }
    if (mode === "special") patch(item.id, {}, { mode: "special", song: item.music.song || null });
    else patch(item.id, {}, { mode: "playlist", songs: item.music.songs || [], limit: item.music.limit ?? null });
  };

  const toggleGenre = (g) => {
    const next = genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g];
    onChangeGenres?.(next);
  };

  const showTimes = moments.some((m) => m.time);
  const leftoverQuick = QUICK_BLOCKS.filter((b) => !moments.some((m) => (m.event || "").toLowerCase() === b.label.toLowerCase()));

  const quietLink = {
    background: "none", border: "none", color: C.accent, cursor: "pointer",
    fontWeight: 700, fontSize: 13, fontFamily: BRAND_FONT, padding: 0,
  };

  return (
    <div>
      {showHeader && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>Run Sheet</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
              The night in order. Skip times if you just need playlists like Prelude, Dinner, Dancing.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => { setImportTab("pdf"); setImportOpen(true); }} style={actionBtn(false)}>Import PDF</button>
            <button type="button" onClick={addBlank} style={actionBtn(true)}>+ Add</button>
          </div>
        </div>
      )}

      {leftoverQuick.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {leftoverQuick.map((b) => (
            <button key={b.label} type="button" onClick={() => addQuick(b)} style={{ ...pillBtn(false), padding: "7px 12px" }}>
              + {b.label}
            </button>
          ))}
        </div>
      )}

      {moments.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 13, padding: "28px 16px", textAlign: "center", background: C.surfaceAlt, borderRadius: 14, border: `1px dashed ${C.border}` }}>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 8 }}>Start with the blocks of the night</div>
          <div style={{ marginBottom: 4, maxWidth: 400, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
            Tap Prelude, Dinner, or Dancing above — or add your own. Times are optional.
          </div>
        </div>
      ) : (
        <div>
          {moments.map((item, idx) => {
            const music = item.music;
            const playlistSongs = music.mode === "playlist" ? (music.songs || []) : [];
            const limit = music.mode === "playlist" ? music.limit : null;
            const atLimit = limit != null && playlistSongs.length >= limit;
            const specialSong = music.mode === "special" ? music.song : null;
            return (
              <div key={item.id || idx} style={{
                display: "grid",
                gridTemplateColumns: showTimes ? "72px 22px 1fr" : "22px 1fr",
                gap: 0,
                marginBottom: 10,
              }}>
                {showTimes && (
                  <div style={{ paddingTop: 18, textAlign: "right", paddingRight: 10 }}>
                    <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 800, color: item.time ? C.accent : C.mutedLight }}>
                      {item.time || ""}
                    </div>
                  </div>
                )}
                <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                  <div style={{ position: "absolute", top: 0, bottom: idx === moments.length - 1 ? "55%" : 0, width: 2, background: C.accent + "22" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.accent, marginTop: 22, zIndex: 1 }} />
                </div>
                <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <input
                      ref={(el) => { titleRefs.current[item.id] = el; }}
                      value={item.event}
                      onChange={(e) => patch(item.id, { event: e.target.value, label: e.target.value })}
                      placeholder="Name this (Dinner, First Dance…)"
                      style={{
                        ...iStyle, fontWeight: 800, fontSize: 15, padding: "6px 8px",
                        background: "transparent", border: "1px solid transparent",
                      }}
                      onFocus={(e) => { e.target.style.border = `1px solid ${C.border}`; e.target.style.background = C.surfaceAlt; }}
                      onBlur={(e) => { e.target.style.border = "1px solid transparent"; e.target.style.background = "transparent"; }}
                    />
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, paddingTop: 4 }}>
                      <button type="button" disabled={idx === 0} onClick={() => move(idx, -1)} style={{ background: "none", border: "none", color: C.muted, cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                      <button type="button" disabled={idx === moments.length - 1} onClick={() => move(idx, 1)} style={{ background: "none", border: "none", color: C.muted, cursor: idx === moments.length - 1 ? "default" : "pointer", opacity: idx === moments.length - 1 ? 0.3 : 1 }}>↓</button>
                      <button type="button" onClick={() => commit(moments.filter((m) => String(m.id) !== String(item.id)))} style={{ background: "none", border: "none", color: C.mutedLight, cursor: "pointer", fontSize: 16 }}>×</button>
                    </div>
                  </div>

                  <div style={{ margin: "4px 0 10px" }}>
                    <OptionalTime value={item.time} onChange={(time) => patch(item.id, { time })} />
                  </div>

                  <input
                    value={item.note}
                    onChange={(e) => patch(item.id, { note: e.target.value })}
                    placeholder="What happens here (optional)"
                    style={{ ...iStyle, fontSize: 13, color: C.muted, background: "transparent", border: "1px solid transparent", padding: "4px 8px", marginBottom: 10 }}
                    onFocus={(e) => { e.target.style.border = `1px solid ${C.border}`; e.target.style.background = C.surfaceAlt; }}
                    onBlur={(e) => { e.target.style.border = "1px solid transparent"; e.target.style.background = "transparent"; }}
                  />

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: music.mode === "none" ? 0 : 10 }}>
                    <button type="button" onClick={() => setMode(item, "playlist")} style={pillBtn(music.mode === "playlist")}>Playlist</button>
                    <button type="button" onClick={() => setMode(item, "special")} style={pillBtn(music.mode === "special")}>Special song</button>
                  </div>

                  {music.mode === "special" && (
                    specialSong?.title ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: C.surfaceAlt, borderRadius: 10 }}>
                        {specialSong.albumArt && <img src={specialSong.albumArt} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover" }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{specialSong.title}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{specialSong.artist}</div>
                        </div>
                        <button type="button" onClick={() => patch(item.id, {}, { mode: "special", song: null })} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: BRAND_FONT, fontSize: 12 }}>Clear</button>
                      </div>
                    ) : (
                      <SpotifyPicker placeholder="Search one song…" onPick={(song) => patch(item.id, {}, { mode: "special", song })} />
                    )
                  )}

                  {music.mode === "playlist" && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.muted, fontWeight: 600, fontFamily: BRAND_FONT }}>
                          Client song limit
                          <input
                            type="number"
                            min={1}
                            placeholder="None"
                            value={limit == null ? "" : limit}
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              patch(item.id, {}, { mode: "playlist", songs: playlistSongs, limit: v === "" ? null : Math.max(1, Number(v) || 1) });
                            }}
                            style={{ ...iStyle, width: 80, padding: "6px 8px" }}
                          />
                        </label>
                        {limit != null && <span style={{ fontSize: 11, fontWeight: 700, color: atLimit ? "#DC2626" : C.muted }}>{playlistSongs.length}/{limit}</span>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                        {playlistSongs.map((t, ti) => (
                          <SongRow key={ti} song={t} onRemove={() => patch(item.id, {}, {
                            mode: "playlist",
                            songs: playlistSongs.filter((_, i) => i !== ti),
                            limit,
                          })} />
                        ))}
                      </div>
                      {atLimit ? (
                        <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>Limit reached.</div>
                      ) : (
                        <SpotifyPicker
                          placeholder={`Add songs to ${item.event || "this playlist"}…`}
                          onPick={(song) => patch(item.id, {}, { mode: "playlist", songs: [...playlistSongs, song], limit })}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <button type="button" onClick={addBlank} style={{ ...quietLink, margin: "4px 0 8px 22px" }}>+ Add another</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 13 }}>
        <button type="button" onClick={() => onOpenCue?.(ev?.id, { intent: "timeline" })} style={quietLink}>Generate with CUE</button>
        <button type="button" onClick={() => { setImportTab("pdf"); setImportOpen(true); }} style={quietLink}>Import PDF / paste</button>
        <button type="button" onClick={() => setShowWishes((v) => !v)} style={{ ...quietLink, color: C.muted }}>{showWishes ? "Hide" : "Genres & skips"}</button>
      </div>

      {showWishes && (
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 16px", marginTop: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Genres & skips</div>
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
      )}

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
