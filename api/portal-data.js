const { createClient } = require("@supabase/supabase-js");
const { resolvePortalAccess } = require("./_lib/portalTokens");
const { isRateLimited, clientIp } = require("./_lib/rateLimit");
const { applyCors } = require("./_lib/cors");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Clients may only write these keys. contracts/events/invoices removed:
// a portal visitor must never rewrite contracts, the event, or billing.
const ALLOWED_WRITE_KEYS = ["requests", "questionnaireInstances"];

/** Legacy name+client matching removed — IDs only (prevents sibling-event document bleed). */
const recordLinksToEvent = (rec, id) => {
  if (rec?.eventId != null && rec.eventId !== "") return String(rec.eventId) === id;
  if (rec?.linkedEventId != null && rec.linkedEventId !== "") return String(rec.linkedEventId) === id;
  return false;
};

const sameEvent = (rec, id) => recordLinksToEvent(rec, id);

const PUBLIC_DJ_PROFILE_FIELDS = [
  "brandColor",
  "businessName",
  "djName",
  "logoPhoto",
  "city",
  "market",
  "location",
  "phone",
  "email",
  "website",
];

function publicDjProfile(profile) {
  if (!profile || typeof profile !== "object") return {};
  const out = {};
  for (const key of PUBLIC_DJ_PROFILE_FIELDS) {
    if (profile[key] != null && profile[key] !== "") out[key] = profile[key];
  }
  return out;
}

/** Only signature-related fields may be set from the portal. */
const applyClientSignature = (contract, { signerName, signatureData, signedAt }) => {
  const when = signedAt || new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
  const logEntry = {
    time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    action: `Signed by ${signerName}`,
    color: "#16A34A",
  };
  return {
    ...contract,
    status: "Signed",
    signed: when,
    signedDate: when,
    signedAt: when,
    signedBy: signerName,
    signatureDrawn: true,
    ...(signatureData != null ? { signatureData } : {}),
    openLog: [...(Array.isArray(contract.openLog) ? contract.openLog : []), logEntry],
  };
};

module.exports = async function handler(req, res) {
  applyCors(req, res, { methods: "POST, OPTIONS", headers: "Content-Type" });
  if (req.method === "OPTIONS") return res.status(200).end();
  // POST body required for token (avoids query/Referer leakage).
  if (req.method === "GET") {
    return res.status(405).json({ error: "Use POST with token in body" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const eventId = req.body?.eventId;
  const token = req.body?.token;
  if (!eventId || !token) return res.status(400).json({ error: "Missing params" });
  const id = String(eventId);

  const ip = clientIp(req);
  if (await isRateLimited(`portal-data:${ip}:${id}`, { limit: 60, windowMs: 60 * 1000 })) {
    return res.status(429).json({ error: "Too many requests. Please wait a moment." });
  }

  // 1. Resolve token -> djUserId (O(1) index; expiry/revoke aware; legacy scan + backfill)
  let access;
  try {
    access = await resolvePortalAccess(supabase, eventId, token);
  } catch (e) {
    console.error("Portal token resolve error:", e);
    return res.status(500).json({ error: "DB error" });
  }
  if (!access?.djUserId) return res.status(401).json({ error: "Invalid token" });
  const djUserId = access.djUserId;

  // 2. Load ONLY this DJ's rows.
  const readKeys = ["djProfile","events","contracts","invoices","requests",
                    "timelines","djTimelines","questionnaireInstances","customQuestionnaires","portalSettings"];
  const { data: rows, error } = await supabase
    .from("user_data").select("key, value").eq("user_id", djUserId).in("key", readKeys);
  if (error) return res.status(500).json({ error: "DB error" });

  const blob = {};
  for (const r of (rows || [])) blob[r.key] = r.value;

  const buildPortalLoadPayload = () => {
    const thisEvent = (blob.events || []).find(e => String(e.id) === id) || null;
    const arr = (x) => Array.isArray(x) ? x : [];
    const tl  = blob.djTimelines || blob.timelines || {};
    const contracts = arr(blob.contracts).filter(c => recordLinksToEvent(c, id));
    const invoices = arr(blob.invoices).filter(i => recordLinksToEvent(i, id));
    const questionnaireInstances = arr(blob.questionnaireInstances).filter(q =>
      recordLinksToEvent(q, id)
    );
    return {
      // Do not expose internal djUserId to portal clients.
      djProfile: publicDjProfile(blob.djProfile),
      customQuestionnaires: blob.customQuestionnaires ?? [],
      events: thisEvent ? [thisEvent] : [],
      contracts,
      invoices,
      requests: arr(blob.requests).filter(r => sameEvent(r, id)),
      questionnaireInstances,
      djTimelines: { [id]: tl[id] || tl[Number(id)] || [] },
      portalSettings: {
        allowPayments: false,
        allowContract: blob.portalSettings?.allowContract !== false,
        allowQuestionnaire: blob.portalSettings?.allowQuestionnaire !== false,
        allowMusicRequests: blob.portalSettings?.allowMusicRequests !== false,
        allowMustDoNotPlay: !!blob.portalSettings?.allowMustDoNotPlay,
        allowTimeline: blob.portalSettings?.allowTimeline !== false,
        welcomeMsg: typeof blob.portalSettings?.welcomeMsg === "string" ? blob.portalSettings.welcomeMsg : "",
      },
    };
  };

  // POST body required for token (avoids query/Referer leakage).
  if (req.method === "GET") {
    return res.status(405).json({ error: "Use POST with token in body" });
  }

  if (req.method === "POST") {
    const { action } = req.body || {};

    if (!action || action === "load") {
      return res.status(200).json(buildPortalLoadPayload());
    }

    if (action === "patchEventMusic") {
      const music = req.body?.music;
      if (!music || typeof music !== "object") {
        return res.status(400).json({ error: "Missing music patch" });
      }
      const events = Array.isArray(blob.events) ? blob.events : [];
      const idx = events.findIndex((e) => String(e.id) === id);
      if (idx < 0) return res.status(404).json({ error: "Event not found" });

      const current = events[idx];
      const patch = {};
      if (music.genres != null) patch.genres = music.genres;
      if (music.clientGenres != null) patch.clientGenres = music.clientGenres;
      if (music.playlistUrl != null) patch.playlistUrl = music.playlistUrl;
      if (music.doNotPlay != null) patch.doNotPlay = music.doNotPlay;
      if (music.mustPlay != null) patch.mustPlay = music.mustPlay;
      if (music.templateId != null) patch.templateId = music.templateId;

      const mergedMusic = { ...(current.music || {}), ...patch };
      const updatedEvents = events.map((e, i) =>
        i === idx
          ? {
              ...e,
              music: mergedMusic,
              ...(patch.doNotPlay != null ? { doNotPlay: patch.doNotPlay } : {}),
            }
          : e
      );

      const { error: writeErr } = await supabase.from("user_data").upsert(
        { user_id: djUserId, key: "events", value: updatedEvents, updated_at: new Date().toISOString() },
        { onConflict: "user_id,key" }
      );
      if (writeErr) return res.status(500).json({ error: writeErr.message });

      return res.status(200).json({ ok: true, music: mergedMusic });
    }

    if (action === "patchRunSheetSong") {
      const momentId = req.body?.momentId;
      const op = String(req.body?.op || "add");
      const rawSong = req.body?.song;
      const songId = req.body?.songId;
      if (momentId == null || momentId === "") {
        return res.status(400).json({ error: "Missing momentId" });
      }

      const normalizeSong = (song) => {
        if (!song || typeof song !== "object") return null;
        const title = String(song.title || song.song || "").trim();
        if (!title) return null;
        return {
          id: song.id || `song_${Date.now()}`,
          title,
          artist: String(song.artist || "").trim(),
          albumArt: song.albumArt || "",
          link: song.link || song.spotifyUrl || "",
          previewUrl: song.previewUrl || "",
          durationMs: song.durationMs || song.duration || "",
          addedBy: "client",
        };
      };
      const itemMode = (item) => {
        if (item?.musicMode === "playlist" || item?.musicMode === "special" || item?.musicMode === "none") return item.musicMode;
        if (item?.songData?.title) return "special";
        if ((item?.playlistSongs || []).length) return "playlist";
        return "none";
      };
      const sectionsFromItems = (items) => (items || []).flatMap((m) => {
        const mode = itemMode(m);
        if (mode === "none") return [];
        const secId = m.linkedSectionId || `sec_rs_${m.id}`;
        const name = m.event || m.label || "Moment";
        if (mode === "special") {
          return [{
            id: secId, name, type: "special", song: m.songData || null,
            startTime: m.time || "", endTime: "", linkedMomentId: m.id, sourceLimit: 1,
          }];
        }
        return [{
          id: secId, name, type: "playlist", songs: m.playlistSongs || [],
          startTime: m.time || "", linkedMomentId: m.id, songLimit: m.songLimit ?? null,
        }];
      });

      const tlBlob = (blob.djTimelines && typeof blob.djTimelines === "object")
        ? blob.djTimelines
        : ((blob.timelines && typeof blob.timelines === "object") ? blob.timelines : {});
      const items = Array.isArray(tlBlob[id]) ? tlBlob[id] : (Array.isArray(tlBlob[Number(id)]) ? tlBlob[Number(id)] : []);
      const idx = items.findIndex((m) => String(m.id) === String(momentId));
      if (idx < 0) return res.status(404).json({ error: "Run sheet moment not found" });

      const current = items[idx];
      const mode = itemMode(current);
      let nextItem = current;
      if (mode === "special") {
        if (op === "remove") {
          nextItem = { ...current, musicMode: "none", songData: null, linkedSectionId: null };
        } else {
          const song = normalizeSong(rawSong);
          if (!song) return res.status(400).json({ error: "Missing song" });
          nextItem = { ...current, musicMode: "special", songData: song, playlistSongs: [] };
        }
      } else if (op === "remove") {
        const nextSongs = (current.playlistSongs || []).filter((sg) => String(sg.id) !== String(songId));
        nextItem = {
          ...current,
          musicMode: nextSongs.length ? "playlist" : "none",
          playlistSongs: nextSongs,
          linkedSectionId: nextSongs.length ? (current.linkedSectionId || `sec_rs_${current.id}`) : null,
        };
      } else {
        const song = normalizeSong(rawSong);
        if (!song) return res.status(400).json({ error: "Missing song" });
        const limit = current.songLimit != null && current.songLimit !== "" ? Number(current.songLimit) : null;
        if (Number.isFinite(limit) && limit > 0 && (current.playlistSongs || []).length >= limit) {
          return res.status(400).json({ error: `This section is limited to ${limit} song${limit === 1 ? "" : "s"}` });
        }
        nextItem = {
          ...current,
          musicMode: "playlist",
          playlistSongs: [...(current.playlistSongs || []), song],
          linkedSectionId: current.linkedSectionId || `sec_rs_${current.id}`,
        };
      }

      const nextItems = items.map((m, i) => (i === idx ? nextItem : m));
      const nextTimelines = { ...tlBlob, [id]: nextItems };

      const { error: tlErr } = await supabase.from("user_data").upsert(
        { user_id: djUserId, key: "djTimelines", value: nextTimelines, updated_at: new Date().toISOString() },
        { onConflict: "user_id,key" }
      );
      if (tlErr) return res.status(500).json({ error: tlErr.message });

      const events = Array.isArray(blob.events) ? blob.events : [];
      const evIdx = events.findIndex((e) => String(e.id) === id);
      let mergedMusic = null;
      if (evIdx >= 0) {
        const currentEv = events[evIdx];
        mergedMusic = { ...(currentEv.music || {}), sections: sectionsFromItems(nextItems) };
        const updatedEvents = events.map((e, i) => (i === evIdx ? { ...e, music: mergedMusic } : e));
        const { error: evErr } = await supabase.from("user_data").upsert(
          { user_id: djUserId, key: "events", value: updatedEvents, updated_at: new Date().toISOString() },
          { onConflict: "user_id,key" }
        );
        if (evErr) return res.status(500).json({ error: evErr.message });
      }

      return res.status(200).json({ ok: true, items: nextItems, music: mergedMusic, moment: nextItem });
    }

    if (action === "signContract") {
      const contractId = req.body?.contractId;
      const signerName = String(req.body?.signerName || "").trim();
      const signatureData = req.body?.signatureData;
      const signedAt = req.body?.signedAt;

      if (!contractId || !signerName) {
        return res.status(400).json({ error: "Missing contractId or signerName" });
      }

      const thisEvent = (blob.events || []).find(e => String(e.id) === id) || null;
      const existing = Array.isArray(blob.contracts) ? blob.contracts : [];

      const idx = existing.findIndex(c => String(c?.id) === String(contractId));
      if (idx < 0) {
        return res.status(404).json({ error: "Contract not found" });
      }

      const current = existing[idx];
      if (!recordLinksToEvent(current, id)) {
        return res.status(403).json({ error: "Contract does not belong to this event" });
      }

      if (current.status === "Signed" && current.signedBy) {
        return res.status(200).json({ ok: true, contract: current, alreadySigned: true });
      }

      const updated = applyClientSignature(current, { signerName, signatureData, signedAt });
      const merged = existing.map((c, i) => (i === idx ? updated : c));

      const { error: writeErr } = await supabase.from("user_data").upsert(
        { user_id: djUserId, key: "contracts", value: merged, updated_at: new Date().toISOString() },
        { onConflict: "user_id,key" }
      );
      if (writeErr) return res.status(500).json({ error: writeErr.message });

      return res.status(200).json({ ok: true, contract: updated });
    }

    const { key, value } = req.body;
    if (!ALLOWED_WRITE_KEYS.includes(key))
      return res.status(403).json({ error: "Write not allowed for key: " + key });

    const dbKey = key === "timelines" ? "djTimelines" : key;
    const { data: cur, error: curErr } = await supabase
      .from("user_data").select("value").eq("user_id", djUserId).eq("key", dbKey).maybeSingle();
    if (curErr) return res.status(500).json({ error: curErr.message });

    let merged;
    if (key === "timelines") {
      const existing = (cur?.value && typeof cur.value === "object") ? cur.value : {};
      const incoming = (value && typeof value === "object") ? (value[id] ?? value) : [];
      merged = { ...existing, [id]: incoming };
    } else {
      const existing = Array.isArray(cur?.value) ? cur.value : [];
      const others = existing.filter(r => !sameEvent(r, id));
      const incoming = (Array.isArray(value) ? value : [])
        .filter(r => sameEvent(r, id) || r?.eventId == null)
        .map(r => ({ ...r, eventId: r?.eventId ?? eventId }));
      merged = [...others, ...incoming];
    }

    const { error: writeErr } = await supabase.from("user_data").upsert(
      { user_id: djUserId, key: dbKey, value: merged, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" }
    );
    if (writeErr) return res.status(500).json({ error: writeErr.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
