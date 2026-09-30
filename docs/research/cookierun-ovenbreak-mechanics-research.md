# CookieRun: OvenBreak (跑跑薑餅人：烤箱大逃亡) — Core Mechanics Research

**Purpose:** Primary-source research on the confirmed rules/mechanics of Devsisters' endless runner *CookieRun: OvenBreak* (international rebrand of the Korean *쿠키런/Cookie Run* franchise; Traditional Chinese storefronts list it as *跑跑薑餅人：烤箱大逃亡*), to inform the **design of an original, unrelated browser-based endless runner**. This document reports only what could be verified in official/first-party materials, and explicitly separates confirmed facts from unverified/assumed details.

**Research date:** All sources below were accessed **2026-09-30**.

> ⚠️ **Copyright/IP notice:** This document describes abstract game *mechanics and rules* (genre conventions such as "auto-run + jump/slide" are not copyrightable expression). It does **not** reproduce, and this project must **not** copy or reuse, Devsisters' copyrighted **art, character names/designs (e.g., the "Cookie" characters), story/flavor text, audio, or branding/trademarks** ("CookieRun", "OvenBreak", "Devsisters", cookie-character names, logos, etc.). Any original game inspired by this research should use wholly original characters, art, names, story, and audio.

---

## 1. Source inventory (first-party / official only)

| # | Source | Type | URL | Accessed |
|---|---|---|---|---|
| S1 | CookieRun: OvenBreak Official Press Kit | Official press kit (Devsisters Corp) | https://www.cookierun.com/presskit/ | 2026-09-30 |
| S2 | CookieRun: OvenBreak — Apple App Store (US/English) | Official storefront listing, controlled by publisher | https://apps.apple.com/us/app/cookierun-ovenbreak/id963067330 | 2026-09-30 |
| S3 | CookieRun: OvenBreak — Google Play (English) | Official storefront listing, controlled by publisher | https://play.google.com/store/apps/details?id=com.devsisters.gb | 2026-09-30 |
| S4 | 跑跑薑餅人：烤箱大逃亡 — Apple App Store Taiwan (Traditional Chinese) | Official storefront listing, controlled by publisher | https://apps.apple.com/tw/app/%E8%B7%91%E8%B7%91%E8%96%91%E9%A4%85%E4%BA%BA-%E7%83%A4%E7%AE%B1%E5%A4%A7%E9%80%83%E4%BA%A1/id963067330 | 2026-09-30 |
| S5 | Devsisters corporate site — "CookieRun" game page | Official developer site | https://www.devsisters.com/en/games/cookierun | 2026-09-30 |
| S6 | Devsisters corporate site — "About" page | Official developer site | https://www.devsisters.com/en/about | 2026-09-30 |
| S7 | Devsisters corporate site — "Oven Games" studio page | Official developer site | https://www.devsisters.com/en/studios/ovengames | 2026-09-30 |
| S8 | Google Play "Developer Stories" — Devsisters case study | Official Google-published case study containing direct, attributed quotes from Devsisters VP Hyoungook Bae | https://developer.android.com/stories/games/devsisters | 2026-09-30 |
| S9 | CookieRun: OvenBreak Help & Support Center (homepage) | Official support site (Devsisters, Zendesk-hosted) | https://cs-cookierun.devsisters.com/hc/en-us | 2026-09-30 |
| S10 | CookieRun: OvenBreak Help & Support Center — topic index | Official support site category listing | https://cs-cookierun.devsisters.com/hc/en-us/categories/34605523897625-Choose-a-topic | 2026-09-30 |
| S11 | Help Center search: "energy" — **no results** | Official support site search (negative result, noted as a gap) | https://cs-cookierun.devsisters.com/hc/en-us/search?query=energy | 2026-09-30 |
| S12 | Help Center search: "jelly" — **no results** | Official support site search (negative result, noted as a gap) | https://cs-cookierun.devsisters.com/hc/en-us/search?query=jelly | 2026-09-30 |

Non-primary sources (fan wikis, third-party guide blogs such as BlueStacks/note.com) surfaced during discovery searches were **deliberately excluded as citations** for confirmed facts, per the request to rely on authoritative/first-party material. Where such sources are the *only* place a commonly-repeated claim appears, it is listed in §4 ("Not confirmed") rather than presented as fact.

---

## 2. Game identity (confirmed)

- Developer/publisher: **Devsisters Corp**, headquartered in Seoul, South Korea; founded 2007. [S1], [S6]
- *CookieRun: OvenBreak* is the flagship title of Devsisters' "Oven Games" studio, released in **2016** (press kit gives the specific date **October 27, 2016**). [S1], [S7]
- Platforms: iOS and Android (free-to-play with in-app purchases). [S1], [S2], [S3]
- Genre, in Devsisters' own words/attributed quotes: **"endless runner"** (press kit, App Store, Google Play all use this term) and, per a Devsisters VP quoted in an official Google Play "Developer Stories" case study, a **"running arcade"** / **"casual game"**. [S1], [S2], [S3], [S8]
- Localized branding: the Traditional Chinese App Store lists the same game (identical developer, screenshots, and feature set) under the title **跑跑薑餅人：烤箱大逃亡**, confirming this is the same product the user referred to as "跑跑薑餅人." [S4]
- Historical note (context only, not a mechanic): Devsisters' own "About" copy references an earlier, separate **"OvenBreak"** series alongside the **"CookieRun"** series as its two most successful franchises; the original Korean **Cookie Run** launched on the Kakao platform in 2013 before the 2016 global release/rebrand analyzed here. This lineage detail is secondary context, not verified in full detail from a single primary source, and is **not** load-bearing for the mechanics findings below. [S1]

---

## 3. Confirmed mechanics and game loop

Each item below is stated in materials that Devsisters directly authors/controls (press kit, App Store/Google Play copy it supplies to the stores, or its own corporate domain). Identical wording/claims appearing independently across the **English App Store, English Google Play, Traditional Chinese App Store, and the press kit** are called out as *cross-verified*.

### 3.1 Automatic running (endless runner structure)
- The game is consistently and independently self-labeled an **"endless runner"** with **"side scroller"/"platformer" levels** across the press kit, both English store listings, and (in translated form) the Traditional Chinese listing. [S1], [S2], [S3], [S4] — *cross-verified across 4 sources*.
- Store copy frames a run's duration explicitly as bounded by a resource, not by player-controlled speed or distance: players "Race through dynamic side scroller levels **for as long as your energy can last**." [S2], [S3] — *cross-verified across 2 sources (identical phrase in both US App Store and Google Play listings)*.
- **Inference (not a verbatim statement):** No official feature list mentions any player control over forward speed, steering, or lane-changing — only "Jump and Slide" are ever named as inputs (see 3.2). Combined with the "endless runner" label, this supports the standard genre inference that **forward movement is automatic** and the two named inputs are the entirety of player control. This is presented here as a well-supported inference from confirmed facts, not an explicit Devsisters quote saying "movement is automatic."

### 3.2 Controls: Jump and Slide
- The core input scheme is stated **identically in substance across all four independent official listings**: "**Jump and Slide** to eat Jellies and avoid obstacles" (press kit); "**Jump and Slide** to avoid obstacles and eat delicious treats" (US App Store); "**Jump and Slide** to eat Jellies and other delicious treats while avoiding obstacles" (Google Play); "利用**跳躍**與**滑行**，獲得果凍或閃避障礙物" (lit. "Use **jump** and **slide** to obtain jellies or dodge obstacles") (Taiwan App Store). [S1], [S2], [S3], [S4] — *cross-verified across 4 independent sources, in two languages*.
- These two actions serve a **dual offensive/defensive purpose**: collecting the Jelly collectible (score) and avoiding obstacles, per the same sources above.
- **Not confirmed:** No official source reviewed defines a mid-air double jump, hold-vs-tap distinctions, slide duration/cooldown, or any third input (e.g., a dedicated skill button). Community guides describe such nuances, but none appear in Devsisters' own store copy, press kit, corporate pages, or support-center search results (§4).

### 3.3 Energy system (the only named resource/"health" mechanic)
- Devsisters' own materials name only **"energy"** as the resource governing run length; no official source used the terms "health," "HP," or "lives" for this mechanic. [S2], [S3]
- Confirmed function: a run continues **"for as long as your energy can last"** — i.e., energy is the explicit gate on how long a single endless-run attempt lasts before it ends. [S2], [S3] — *cross-verified across 2 sources*.
- **Gap/negative finding:** The official Help & Support Center returns **zero articles** for the search terms "energy" and "jelly" (§ S11, S12), meaning Devsisters has not publicly documented (at least not in indexed support articles) the exact starting energy amount, depletion rate/triggers (e.g., whether hitting an obstacle costs extra energy vs. passive time-based drain), or regeneration mechanics. **Any specific numeric energy formula is an assumption, not a confirmed fact**, per this research.

### 3.4 Obstacles
- Confirmed only at a generic level: the run includes **"obstacles"** that must be avoided via Jump/Slide, and stage theming/difficulty escalates — official copy describes levels ranging "**from sweet and sugary to perilous and thrilling**." [S2]
- **Not confirmed:** No official source itemizes specific obstacle types (e.g., pits, low bars, saw blades, moving platforms). This taxonomy is not published in any first-party material reviewed.

### 3.5 Collectibles
Confirmed collectible/economy categories, all independently named across official sources:
- **Jellies** — the primary collectible gathered via Jump/Slide during a run and tied to score ("eat Jellies"). [S1], [S2], [S3], [S4] — *cross-verified across 4 sources*.
- **Chests** — reward containers used to "unlock and collect" playable Cookie characters and Pets. [S1]
- **Trophies** — described in the press kit as collectible items that "discover lands full of surprises and adventure," i.e., tied to unlocking further content/progression. [S1] (Note: current App Store/Google Play copy instead names a **"Trophy Race"** competitive mode — see 3.7 — suggesting this system's presentation evolved between the press kit's writing and the current store listings; both are reported here with their respective sourcing rather than merged into one claim.)
- **Pets** and **Treasures** — additional collectible/equippable categories that can be **upgraded** to raise achievable score: "Upgrade Cookies, Pets, and Treasures to achieve high scores." [S2], [S3] — *cross-verified across 2 sources*.
- Scale: current listings state **"Collect over 200 Cookies & Pets"** with new ones "added every month" [S2], [S3], whereas the press kit (reflecting the 2016 launch state) states **"over 80"** — both figures are accurately reported here with their own sourcing/likely time period rather than treated as one number.
- **Not confirmed:** No official source names specific Jelly sub-types, per-item point values, or a "combo"/multiplier scoring mechanic. These are common in third-party community guides but were not found in any Devsisters-controlled material reviewed.

### 3.6 Score and leaderboards
- Confirmed: players "**beat their high score**" against players worldwide (press kit) [S1]; "**Race to the top of the leaderboard**" (US App Store) [S2]; "compete for a top spot on **the leaderboard**" (Google Play) [S3]. — *cross-verified across 3 sources*.
- Confirmed: an upgrade/meta-progression system (leveling Cookies/Pets/Treasures) is explicitly tied to raising achievable score, per 3.5 above. [S2], [S3]
- **Not confirmed:** exact scoring formula, point values, or any "combo" mechanic (see 3.5).

### 3.7 Stage and mission progression / game modes
- Confirmed generic stage structure: "**Run through platformer stages with challenging missions**" (US App Store) [S2]; "platformer stages with **fun mission challenges**" (Google Play) [S3] — *cross-verified across 2 sources*. Official copy does not enumerate what a "mission" consists of (e.g., objective types), so specifics beyond "missions exist within stages" are **not confirmed**.
- Confirmed named game modes, identically listed across English and Traditional-Chinese official storefronts:
  - **Breakout Mode** — a relay run using several Cookie characters in sequence ("Long relay run with several Cookies"). [S2], [S3], [S4]
  - **Trophy Race** — real-time/competitive racing "with players from around the world" for leaderboard position. [S1] (as "1v1 Race"/high-score competition), [S2], [S3], [S4]
  - **Cookie Trials** — a mode to upgrade/optimize an individual Cookie "to full potential" toward high scores. [S2], [S3], [S4]
  - **Champions League** — described as "a league only for the toughest," i.e., a top competitive tier. [S2]
  - **Island of Memories** — a mode to "discover Cookies' background stories" (lore/story content). [S2]
- These five mode names and one-line descriptions are consistent across the US App Store, Google Play, and Taiwan App Store listings, giving strong (3-source) cross-verification for their existence, though **not** for their internal rules (e.g., exact relay hand-off conditions in Breakout Mode are not detailed officially).

### 3.8 Narrative framing (context, not to be reused)
- Devsisters' own corporate page frames the endless-running premise narratively: characters are running to escape an antagonist and find a permanent home ("a land without witches... their sweet Cookie paradise"). [S5] This is mentioned only to explain *why* the official material frames the game as an endless/ongoing run — the specific story, character names, and art are Devsisters IP and are explicitly **out of scope for reuse** in an original game (see IP notice above).

---

## 4. Explicitly NOT confirmed via official sources (commonly assumed elsewhere)

The following are frequently described in fan wikis and third-party strategy blogs surfaced during discovery searches, but **no official Devsisters/App Store/Google Play/press-kit/support-center source reviewed for this report confirms them**. They should be treated as **design assumptions**, not verified CookieRun mechanics, if used:

- A **double jump** (second mid-air jump input).
- Any **numeric energy value**, depletion rate, or regeneration rate/time.
- A **"combo"** scoring multiplier system for consecutive jumps/slides.
- **Per-item point values** for Jelly types or a taxonomy of special "power" Jellies (e.g., speed/size power-ups).
- A specific **obstacle taxonomy** (pit/spike/moving-platform classes) or stage/world map layout.
- Exact **mission objective types** (e.g., "collect N jellies," "reach distance D") within stages.

Searches of the official Help & Support Center for "energy" and "jelly" returned no articles (S11, S12), which is itself evidence that these specifics are not part of Devsisters' public-facing documentation (at least not indexed/discoverable there) as of the access date.

---

## 5. Suggested application to an original browser runner (synthesis, not sourced from CookieRun)

This section is the author's own generic design synthesis based only on the **confirmed, non-copyrightable structural patterns** above (genre conventions common across the endless-runner genre broadly, not unique CookieRun expression). It is **not** a CookieRun fact and carries no citation:

- Auto-scroll/auto-run loop with exactly two reactive inputs (e.g., Jump / Slide or Up / Down) mapped to obstacle avoidance and collectible pickup.
- A single depletable per-run resource (an original "fuel," "stamina," etc. — a new name/visual, not "energy" as Devsisters brands it) that bounds run length and ends the run at zero, creating a natural game-over condition without a separate "lives" system.
- A single common collectible tied directly to the score counter, collected via the same two inputs used for obstacle avoidance (dual-purpose input, as CookieRun does with Jellies).
- Discrete stages/distance checkpoints layered with optional objectives ("missions"), separate from the endless high-score chase, to support structured progression alongside pure score-chasing.
- A persistent high-score/leaderboard loop to drive replay, independent of any specific stage content.

Original names, art, characters, audio, and UI must be created independently; none of the above requires or implies reuse of Devsisters' protected expression.

---

## 6. Gaps and suggested follow-up

- The official Help & Support Center appears scoped to account/billing/technical FAQs, not gameplay documentation — no in-depth "how to play" or mechanics FAQ was discoverable there (§S9–S12).
- Devsisters' investor-relations page could not be located at a stable English URL during this research pass (`devsisters.com/en/ir` returned 404); Korean DART financial filings were referenced only indirectly via search snippets and were not fetched/verified directly, so no claims from them are included above.
- The Devsisters corporate "CookieRun" game page (S5) appears to server-render only the story blurb; its feature/mechanics sections did not yield extractable text (likely client-side-rendered), so it was used only for the narrative-framing note in §3.8.
- If deeper verification is desired, the most promising next step would be requesting an official media/press kit "features" video transcript or contacting Devsisters' press contact (`press@devsisters.com`, per S1) directly, rather than relying on further web search.

---

*Compiled by an autonomous research pass over the sources listed in §1. All claims above are traceable to a specific cited source; §4 explicitly flags what could not be verified.*
