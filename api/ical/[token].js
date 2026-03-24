import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  const { token } = req.query;
  const ics = await kv.get(`ical:${token}`);
  if (!ics) return res.status(404).end();
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store");
  res.send(ics);
}
