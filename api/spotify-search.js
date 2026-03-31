module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { q } = req.query;
  if (!q || !q.trim()) return res.status(400).json({ error: "Query required" });

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(500).json({ error: "Spotify credentials not configured" });

  try {
    // Get access token via client credentials flow
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(500).json({ error: "Failed to get Spotify token" });

    // Search tracks
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=10&market=US`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const searchData = await searchRes.json();

    const tracks = (searchData.tracks?.items || []).map(t => ({
      id: t.id,
      title: t.name,
      artist: t.artists.map(a => a.name).join(", "),
      album: t.album.name,
      albumArt: t.album.images?.[1]?.url || t.album.images?.[0]?.url || null,
      previewUrl: t.preview_url,
      spotifyUrl: t.external_urls?.spotify || null,
      durationMs: t.duration_ms,
    }));

    return res.status(200).json({ tracks });
  } catch (err) {
    console.error("Spotify search error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
