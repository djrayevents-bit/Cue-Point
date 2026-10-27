export const CUE_WELCOME =
  "Hey! I'm CUE — your DJ business assistant inside CuePoint. I know your events, clients, leads, and financials. Ask me anything and I'll give you answers specific to your situation.";

export const QUICK_PROMPTS = [
  { label: "Reply to new inquiry", category: "Email", prompt: "Write a professional and warm email replying to a new wedding inquiry. The client is interested in booking me as their DJ. Ask for their event date, venue, and guest count. Mention my packages and a free consultation call. Sign off with my name and business info." },
  { label: "Quote follow-up", category: "Email", prompt: "Write a friendly follow-up email to a lead who received a quote 3 days ago and hasn't responded. Be warm, not pushy. Mention that my calendar is filling up for their date. Offer to answer any questions or hop on a quick call." },
  { label: "Ask for a review", category: "Email", prompt: "Write a warm, short post-event email asking the client for a Google review. The event went great. Don't sound desperate or salesy. Make it personal and genuine. Include a note about referrals being appreciated. Keep it under 100 words." },
  { label: "Venue intro email", category: "Email", prompt: "Write a cold outreach email to a wedding venue introducing myself as a local DJ looking to get on their preferred vendor list. Highlight my professionalism, experience with weddings, liability insurance, and how a great DJ experience reflects well on the venue. Keep it short and confident." },
  { label: "Overdue invoice nudge", category: "Email", prompt: "Write a polite but firm email reminding a client that their invoice is overdue. Be professional and not passive-aggressive. Mention the original due date, the amount, and accepted payment methods. Offer to help if there's an issue. Keep it short." },
  { label: "Contract follow-up", category: "Email", prompt: "Write a gentle follow-up to a client who hasn't signed their contract yet. Their event date is coming up and I need the signed contract to hold the date. Be warm but create a subtle sense of urgency without being pushy." },
  { label: "Wedding playlist", category: "Music", prompt: "Give me a curated wedding reception playlist structure: cocktail hour (10 songs, laid-back elegant vibe), dinner (10 songs, background ambiance), early dancing (10 songs to warm up the floor), peak dancing (15 songs mixed ages). Include specific song recommendations for each section with artist names." },
  { label: "Corporate playlist", category: "Music", prompt: "Build a corporate event playlist for a professional gala with 150 guests. Cocktail hour: upscale, tasteful background music. Dinner: slightly more energetic but still professional. After-dinner dancing: crowd-pleasing without being too edgy. Include specific songs for each phase." },
  { label: "Hype songs for floor", category: "Music", prompt: "Give me 20 guaranteed floor-fillers for a wedding reception with mixed ages (20s to 60s). Songs that get everyone up regardless of generation. Ranked by reliability. Include brief notes on when to drop each one for maximum impact." },
  { label: "Song transition tips", category: "Music", prompt: "Give me tips on reading a crowd mid-set at a wedding. How do I know when to shift genres, increase energy, or slow things down? What are the signs the floor is losing energy and how do I fix it without killing momentum? Practical advice from a DJ perspective." },
  { label: "MC scripts — wedding", category: "Planning", prompt: "Write MC announcement scripts for a wedding reception: (1) Grand entrance of the wedding party, (2) Bride and groom's first dance, (3) Father-daughter dance, (4) Mother-son dance, (5) Cake cutting, (6) Bouquet toss, (7) Last song send-off. Short, warm, and hype for each." },
  { label: "Event day checklist", category: "Planning", prompt: "Create a comprehensive DJ event day checklist. Include: load-in prep (equipment check, cables, music library sync), arrival tasks (sound check, venue walkthrough, meet coordinator), performance tasks (timeline review, announcements confirmed), and post-event tasks (pack down, load out, invoice follow-up, review request)." },
  { label: "Summarize questionnaire", category: "Planning", prompt: "I'll paste a client questionnaire below. Summarize it into a 1-page DJ brief I can reference the night of the event. Include: key timeline moments, must-play songs, do-not-play list, special requests, family announcements, and any venue/coordinator notes." },
  { label: "Timeline for 5-hour wedding", category: "Planning", prompt: "Build a detailed DJ run-of-show timeline for a 5-hour wedding reception. Include: cocktail hour, grand entrance, first dance, parent dances, dinner, toasts, cake cutting, bouquet toss, open dancing, last song, and send-off. Include suggested times for each moment and brief notes on music energy." },
  { label: "My business snapshot", category: "Business", prompt: "Give me a snapshot of how my business is performing right now. Use my actual data — events, leads, revenue, outstanding invoices. Tell me what's going well, what needs attention, and the top 3 things I should focus on this week." },
  { label: "Raise my rates", category: "Business", prompt: "Help me write a price increase announcement to send to venues and returning clients. I'm raising my rates by 15-20% due to rising equipment costs and increased demand. Keep it professional and confident. Include a 'lock in current rate' offer for bookings made in the next 30 days." },
  { label: "Handle a difficult client", category: "Business", prompt: "Help me write a response to a client who is being very demanding and making last-minute changes 2 days before their event. They want to restructure the timeline and add 15 new must-play songs. I want to be professional and set expectations firmly but kindly." },
  { label: "How should I price this?", category: "Business", prompt: "Help me think through pricing for a 5-hour corporate gala for 300 guests at a high-end hotel. I'll need to arrive 2 hours early for setup, they want uplighting, a photo booth, and a second speaker system for outdoor cocktail hour. Walk me through how to structure and present this quote." },
  { label: "Improve my lead conversion", category: "Business", prompt: "Based on my leads data, help me identify patterns in where I'm losing bookings. What should I be doing differently in my follow-up process? Give me a specific lead nurture sequence I can start using immediately — with timing, message tone, and what to say at each touchpoint." },
  { label: "Write a contract clause", category: "Legal", prompt: "Write a professional contract clause for a DJ services agreement covering: cancellation policy (50% deposit non-refundable, full fee if cancelled within 30 days), force majeure, liability limitations, and overtime rates. Keep it clear but legally sound." },
  { label: "Deposit policy language", category: "Legal", prompt: "Write clear, professional contract language for my deposit and payment policy. I take a 30% non-refundable deposit to hold the date, with the balance due 2 weeks before the event. I accept Venmo, Zelle, check, and credit card (3% fee). Make it firm but not aggressive." },
  { label: "Instagram captions", category: "Marketing", prompt: "Write 5 Instagram caption ideas for a wedding DJ. Mix tones: emotional/heartfelt, high-energy, behind-the-scenes, client testimonial framing, and funny. Include relevant hashtags. Keep captions authentic, not corporate." },
  { label: "LinkedIn post idea", category: "Marketing", prompt: "Write a LinkedIn post about a recent success story from a DJ business perspective — something that shows the professional, operational side of the work, not just the fun. Tone: confident, human, not braggy. Aimed at event planners and venues who might refer business." },
  { label: "Google Business response", category: "Marketing", prompt: "Write a professional, warm response to a 5-star Google review from a wedding client who said the DJ 'made the whole night.' Keep it personal, thank them by first name if possible, and end with something that encourages referrals without being salesy." },
];

export const CUE_PROMPT_CATEGORIES = ["All", "Email", "Music", "Planning", "Business", "Legal", "Marketing"];

export function sortCuePrompts(prompts, sortId = "label", category = "All") {
  const filtered = category === "All"
    ? [...prompts]
    : prompts.filter((p) => p.category === category);
  filtered.sort((a, b) => {
    if (sortId === "category") {
      const byCat = a.category.localeCompare(b.category);
      return byCat !== 0 ? byCat : a.label.localeCompare(b.label);
    }
    return a.label.localeCompare(b.label);
  });
  return filtered;
}
