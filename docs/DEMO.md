# Demo checklist (run through this before judging)

**Setup (T-30 min)**
- [ ] `git pull && npm install && npm run build` passes
- [ ] `.env.local` has `ANTHROPIC_API_KEY` (check `GET /api/health` → `"ai": "live"`)
- [ ] `npm run reset-data && npm run seed` (fresh, realistic demo posts)
- [ ] Phone and laptop both on the app (phone = poster, laptop = judge's view)
- [ ] Backup screen recording saved in case Wi-Fi dies

**Script (2–3 min)**
1. Hook: "Every week, campus events throw away pizza while students skip dinner."
2. Phone: **Post food → Leftovers now** → photograph real snacks → AI fills fields → *edit one field* ("the AI is a suggestion, a person confirms").
3. Laptop: the pin appears within ~5 s, with countdown and allergen warning. Tap **I'm heading there**.
4. **Event poster** mode: upload a club poster → building matched from the fixed list, times filled in.
   - Before posting, on the laptop: tick **Vegetarian** + **🔕 Alert me**. A vegetarian post pops the "🔔 New food" banner and a `(1)` in the tab title.
   - Tap **Share** on a card → the link opens straight to that post (great for club group chats).
5. `/about`: correction-rate stats + eval results ("here's how we measured and improved the AI"), plus how the
   "≈ kg food / kg CO₂e saved" banner is estimated.
6. Impact + next steps: club partnerships, Discord alerts, campus SSO.

**Smoke test**
- [ ] Post with no photo works
- [ ] Owner "Mark as gone" removes the post instantly
- [ ] Two different devices' "It's gone" removes a post
- [ ] Dietary filter + "Nearest first" work on the phone
- [ ] Alerts: a matching post from another device shows the banner within ~5 s; a non-matching one doesn't
- [ ] Shared `/?post=<id>` link opens and highlights the post
- [ ] Panning the map with a post selected doesn't snap back
