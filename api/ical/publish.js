import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { token, ics } = req.body;
  if (!token || !ics) return res.status(400).end();
  await kv.set(`ical:${token}`, ics, { ex: 60 * 60 * 24 * 365 });
  res.status(200).json({ ok: true });
}
