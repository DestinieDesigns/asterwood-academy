# Asterwood Academy — first-person world

This document records what was actually built, how it works, what is still missing, and what was verified. The academy is a real Three.js world rendered inside the existing Asterwood learner app; it is not a static background or a mock-up.

## Implemented

### Playable first-person foundation
- Genuine WebGL scene (`three@0.187.0`) with a rendered courtyard, Grand Library interior, personal quarters and the Chamber of Numbers classroom.
- Pointer-lock mouse look, WASD/arrow movement, run, jump, gravity, per-axis collision against buildings, walls, fountain, statue and trees. Saved or doorway positions inside a wall's collision margin are moved to the nearest walkable point on load, and a player already caught inside a margin can walk out instead of being frozen on every axis.
- First-person rounded forearms and hands (capsule palm, four fingers and a thumb with a cuff at the sleeve) reflecting the learner's chosen skin tone and outfit colour, with walking bob.
- Contextual interaction prompts and `E` interaction: doors, books, NPCs, mirror, journal desk, sealed doors.
- Day/night clock (2 in-game minutes per real second) driving sun colour/intensity, sky, fog and stars.
- Touch controls: drag-to-look on the canvas, a dead-zoned virtual joystick, and separate on-screen Use and Jump buttons. The mobile HUD respects screen safe areas, hides keyboard-only hints, shows a short first-entry gesture hint, and the tutor chat becomes a full-height sheet above the software keyboard.

### Asterwood Studio — characters and tutors
- Full-screen studio at `/characters`, sharing the Sims-like stage: a large rotating 3D avatar on a pedestal, a nameplate, and a roster strip of saved scholars.
- Procedural 3D avatar (skin, six hair styles, hair colours, three outfit cuts, outfit colours, glasses/circlet/scarf, freckles) built from geometry, not images. "Surprise me" randomises a full look.
- A learner keeps up to **four characters** (`adventure_characters`, scoped by learner), with an active character pointer on `adventure_profiles`. New characters are created in the studio; existing ones are selected, edited or deleted there.
- Switching characters changes only the look. Lessons, mastery, reports, discoveries and the tutor's memory stay on the learner profile.
- Tutor selection lives in the same studio: the ten authored tutors with live previews, rename, teaching personality, strictness and the full appearance editor. Saving uses the existing `POST /api/learners/:id/tutor` endpoint.
- Entry points: the nav item **Characters**, the academy gate's *Change character* button, the pause menu, the satchel, and the enchanted mirror (which opens the studio instead of an inline creator).
- First-run onboarding now ends by opening the studio, so a new learner designs a scholar and chooses a tutor before entering the world.
- Appearance changes never touch educational records.

### Living academy slice
- Seven independent NPCs with names, roles, colours and distinct authored personalities: librarian, mathematics professor, gardener, student, astral researcher, provisioner, archivist.
- Time-of-day waypoint routines (morning/afternoon/evening/night); NPCs walk between locations, pause, face the player at close range, and carry floating two-line name/role tags measured to fit their text.
- The player's chosen tutor appears as a following companion: walks behind/beside the player, catches up, turns toward them, and offers occasional contextual lines.
- Companion modes: follow, wait, quiet (no unprompted lines). Also toggled with `C`.

### Talking with your tutor in the world
- Standing within 3.4 m of the companion shows `E Talk to <tutor name>`; `E` pauses the world and opens a chat panel over the 3D view.
- The panel is a second door into the **existing** tutor thread, not a separate chat system: it loads the most recent conversation from `GET /api/tutor/conversations`, continues it through `POST /api/tutor/chat` with that `conversationId`, and reloads the server's messages after each reply. Anything said in the world appears in `/tutor`, and vice versa; memory, safety notices and rewards stay server-side.
- Contextual openers follow the room: courtyard (fountain, library doors, Chamber of Numbers), Grand Library (shelves and books), quarters (desk, journal, mirror) and the Chamber of Numbers (chalkboard and lectern). Choosing one sends a sentence naming the place and what is in front of the player, so the tutor knows what "this" refers to.
- Read-aloud uses the learner's saved voice style, accent, rate and volume, and the selected tutor's gender so a female tutor gets a female system voice: a `Voice on/off` toggle (remembered in `localStorage` as `asterwood:advVoice`), automatic speech for new replies when the profile allows voice, and a `Read aloud` button on every tutor message, with captions.
- Closing with `Esc` or `Leave chat` stops speech and resumes the world.

### Physical library and real curriculum
- Twelve physical books on the library shelves, sourced from the real Asterwood catalogue (title, colour, subject, topic/chapter counts, current progress).
- Interacting with a book lifts it into a reading panel; "Open this volume" enters the existing `/world/:bookId` curriculum and mastery flow.
- Mastery, decay, reports and accountability remain server-side and unchanged. Opening a book in 3D never grants mastery.

### Chamber of Numbers and in-world lessons
- A mathematics classroom west of the plaza, with its own sandstone facade, hanging sign and a door into a full interior: six desks and chairs, a chalkboard painted with equations, a lectern with an open book, warm lamps and slow-turning geometric solids.
- The lectern opens a lesson ledger inside the 3D view. It lists the learner's real lessons (`GET /api/lessons`), offers Asterwood's recommended next topics (`GET /api/lessons-recommended`), and can build a new lesson by subject (`POST /api/lessons/generate`).
- Lessons are read in the world: objectives and every section, with "Got it" toggles that PATCH the same progress the standalone lesson page uses, and a Complete button that PATCHes status `completed`.
- Lesson generation, progress, XP, streak, mastery and decay stay entirely server-side. The panel never computes mastery; completing a lesson credits the same server path as `LessonView`, and mastery still requires the normal assessments.

### Rendering and atmosphere
- **Sky:** a gradient sky dome with a sun glow, replacing the flat background colour. The gradient, horizon and fog colour follow the day/night clock, and nine low-poly clouds drift slowly overhead; the existing stars show at night.
- **Shadows:** the directional sun casts a 2048² PCF shadow map across the courtyard (orthographic ±70 m, normal bias tuned against acne). Every solid mesh casts and receives; transparent glass and the sky are excluded. Shadows are disabled in the interiors (they have no windows), and the quality setting turns the whole shadow pass off.
- **Surfaces:** procedural textures generated at runtime — fine grass grain on a 600 m ground plane, flagstones with visible joints on paths and the plaza, and plank flooring in the Grand Library, quarters and Chamber of Numbers. The plaza gained a stone rim, the quarters a bordered rug and the classroom a long runner with gold edge stripes.
- **Horizon:** a ring of 46 distant conifers and 18 fog-softened low hills closes the horizon, so the ground plane never ends in a hard line.
- **Props and light:** shrub clusters near the buildings, floating books rebuilt with cream pages and gold spines, deeper teal fountain water with a gentle bob, ambient fill light, warmer library beams and crown moulding, and exposure/fog tuned for clearer depth (fog 70–300 m).
- **Quarters:** rebuilt bed (frame, mattress, duvet, pillows, headboard), a painted north-facing landscape window with a four-pane frame and floor-length curtains, a panelled exit door aligned with the “leave your quarters” prompt, warm sconces and a ceiling pendant, a framed constellation print above the desk, ceiling beams, crown moulding and baseboards.
- **Chamber of Numbers:** a plank floor under a striped runner, a framed chalkboard with side trim, a 2×2 grid of framed ceiling light panels with rear fill lights, plus ceiling beams, moulding and baseboards.

### Persistence and controls
- New `adventure_profiles` and `adventure_characters` tables plus `/api/adventure` GET/PATCH and `/api/adventure/characters` CRUD/activate endpoints, scoped to the owning learner (403 for other accounts).
- Saved: active character, appearance, area, position, yaw/pitch, world time, discoveries.
- Loaded positions are validated against each area's walkable bounds (courtyard ±70; library 385.4–414.6 × −12.6–12.6; study ±5.6 × 394.4–405.6; classroom 790.5–809.5 × −7.1–7.1). A point outside its area — including a legacy classroom save clamped to x=600 — is replaced by that area's entrance (the classroom uses 800, 5) instead of being stored clamped and unreachable. The old ±600 coordinate clamp was widened to ±1200 so valid room coordinates are never mangled.
- Legacy single looks are adopted into the roster automatically on first load, named "First look" when unnamed.
- Autosave every 8 seconds, on area change, and on leaving the page; explicit save when appearance or comfort settings change.
- Pause menu (Esc) with journal, satchel, map fast travel, comfort settings, dressing room and exit.
- Comfort options persisted: mouse sensitivity, movement speed, invert Y, reduced head bob, camera shake toggle, high/low quality.
- Journal (`J`), satchel (`I`) and map (`M`), plus HUD buttons; discoveries are recorded as books read, people met and places entered.

### Deliberately marked as not open
- Great Hall door: sealed, with an in-world notice.
- Observatory interior and academy gate beyond the grounds: sealed/informational.
- These are labelled in-game rather than presented as finished spaces.

## Architecture

| Area | Files |
| --- | --- |
| Scene, movement, collision, NPCs, companion | `src/game/engine.ts` |
| Procedural avatar, hands, name tags | `src/game/avatar.ts` |
| 3D creator preview | `src/game/AvatarPreview.tsx` |
| Player page, HUD, overlays, mobile controls | `src/pages/Adventure.tsx` |
| In-world tutor chat | `src/components/AdventureChat.tsx` |
| Adventure styles | `src/adventure.css` |
| Classroom and lectern lesson reader | `src/game/engine.ts` (`buildClassroom`), `src/pages/Adventure.tsx` |
| Lesson and mastery APIs | existing `server/index.js` routes, `src/lib/actions.ts` (unchanged) |
| Persistence | `server/index.js` (`/api/adventure`), `server/db.js` (`adventure_profiles`) |
| Types/client | `src/lib/api.ts` |

The Three.js chunk is lazy-loaded: the main app bundle does not include it, and `/adventure` loads a separate ~605 kB JS chunk (~156 kB gzip).

New dependency: `three` (runtime) and `@types/three` (dev). No physics engine, asset packs, audio files or image assets were added; the world is procedural geometry and canvas-generated textures.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` | Walk |
| `↑ ↓` | Walk forward / back |
| `← →` | Turn |
| Mouse | Look — captured pointer when available, otherwise drag the world |
| `Shift` | Run |
| `Space` | Jump |
| `E` | Interact — books, doors, NPCs, and talk to your companion |
| `C` | Companion follow/wait |
| `J` / `I` / `M` | Journal / satchel / map |
| `Esc` | Release pointer and open pause |

## Verification performed

- Name tags (Chromium preview, live engine): each tag is a measured canvas and a matching sprite. Orin's tag is 331×94 CSS px (sprite 1.06×0.30 m), Mira's 199×94, Caius's 188×94 — all aspect-matched within 0.01. Pixel inspection of the name line and role line showed ≥27 px clear margins on both sides for every NPC, so neither line is cut; roles now sit on their own line (`Mathematics`, `Third-year`, `Greenhouse`, `Astral Studies`), while dialogue headers keep the full titles.

- `bun run typecheck` — passes.
- `bun run build` — passes; separate lazy-loaded `Adventure` chunk confirmed.
- Temporary API harness — **26/26 checks passed**: default profile, full save/reload of appearance/position/settings/discoveries/world time, sanitisation of invalid colours/styles/areas/settings, clamped coordinates, cross-account read/write rejection (403), appearance reset, cleanup. Harness removed after use.
- Browser (Chromium preview, logged-in learner):
  - Character creator rendered a 3D preview and saved appearance.
  - Entry gate and HUD rendered after stepping inside.
  - Map fast travel moved the player to the Grand Library and quarters.
  - Simulated walking collided with the library bounds and arrived in front of the shelves; prompt read `Read "Financial Literacy"`.
  - Interacting opened a real book panel populated from the curriculum (`20 topics`, `4 chapters`, current progress).
  - NPC routine positions were live; approaching Tamsin Reed produced the prompt `Talk to Tamsin Reed` and her authored dialogue.
  - Companion followed and settled ~2.1 m from the player.
  - The enchanted mirror opened the dressing-room creator.
  - Autosave was confirmed through `GET /api/adventure`: area, coordinates, world time and five discoveries persisted.
- Visual review in a visible tab (Chromium, 1203×940 and 935×940) with screenshots of the courtyard, library interior, an NPC close-up and the book panel. Defects found and fixed:
  - hair caps wrapped in front of the eyes, hiding every avatar's face;
  - first-person forearms were oversized flat boxes that read as wooden planks;
  - the tutor companion's follow offset placed it **in front** of the camera, blocking the view;
  - facade banners floated above the colonnade with no hanging rail;
  - the library ceiling rendered as a black void;
  - robed characters' arms poked out above the shoulders while their hands sat inside the robe;
  - NPC name tags were large enough to cover the scene;
  - the app's mobile nav (`z-index: 60`) covered the academy HUD on narrow windows.
- Walking and interaction were exercised with real key events: the player crossed the library to the shelves, the prompt read `Read "Space and Astronomy"`, `E` opened a panel populated from the real catalogue (`18 topics`, `4 chapters`), and the companion settled 1.55 m **behind** the player.
- Later in the session the browser window was minimised, so the final three cosmetic tweaks (arm placement, name-tag scale, nav layering) were confirmed through scene/DOM inspection and the build, not re-screenshotted. Smooth animation, pointer-lock feel and frame rate remain unmeasured.
- Chamber of Numbers: the courtyard door prompt `Enter the Chamber of Numbers` moved the player into the classroom at its spawn, and the room rendered with board, desks, lectern and props. Interacting with the lectern opened the ledger from live API data (no lessons, one recommendation), and `Build a lesson` created a real 9-section lesson through `POST /api/lessons/generate` that rendered inside the world. Clicking `Got it` persisted `progress: 11` server-side and updated the in-panel header. The test lesson was deleted afterwards.
- In-world lesson completion was not exercised end-to-end (it would have credited XP and mastery for a throwaway lesson); the button calls the same `PATCH /api/lessons/:id` the lesson page uses.
- Asterwood Studio (Chromium preview, logged-in learner): the legacy look was adopted into the roster as `First look`; a second character (`Rowan`) was created with a randomised look and saved, which set it active; selecting `First look` and pressing *Enter the academy* activated that character and landed on the gate with the matching appearance; switching to Kaelion in the tutor tab persisted `tutorCharacterId`, name and preset, and the original tutor was restored afterwards. Desktop geometry at 1400 px checked: 631 px stage / 516 px panel, no horizontal overflow. A fixed mobile nav was found intercepting roster clicks and corrected with a studio layer above it.
- The rebrand was verified through the live API meta (`Asterwood Academy`) and the rendered page title.
- Position validation (live API and browser): PATCHing a classroom point at x=600 returned and stored 800, 5; a legitimate point at 809.49, −7.09 kept its exact coordinates, yaw and pitch; a library point at 414.59, 12.59 was preserved; a library point at x=900 and a courtyard point at 71, −200 each respawned at their area entrances (400, 9 and 0, 42). Reloading `/adventure` with the classroom save spawned the engine at 800, 5, `blocked()` was false, and holding `W` moved the player 0.8 m in 0.8 s. The original courtyard position was restored after testing.
- Movement and spawn (Chromium preview): the saved courtyard position was `-22.40, -1.32`, inside the Grand Library's collider margin (`x -31..-21, z -1..7`), so `blocked()` was true and every step was rejected. After the fix the same save loaded at `-23.07, -1.50` with `blocked()` false; holding `W` for 0.9 s moved 1.43 m (velocity 4.27 m/s), and deliberately standing at `-26, 3` (inside the wall) still allowed 0.23 m of escape movement in 0.7 s.
- Tutor voice (Chromium preview, Solenne selected, Windows): `rankVoices` now scores gender ahead of style, and the live read-aloud utterance used **Microsoft Zira** (female) rather than Microsoft David. A Bun check over the three installed voices ranked Zira first for both `energetic` and `professional` with a female tutor, and David first for a male tutor.
- Hands (visual check at 940×940): the previous box palm and three box fingers read as wooden planks; the rebuilt capsules render as two open hands with visible fingers, thumbs and sleeve cuffs. They are low-poly and slightly flat, but no longer rectangular.
- Graphics refinement (Chromium preview, 940×940): reviewed the courtyard at midday and at 22:00, and the Grand Library interior. Midday showed the blue gradient sky, white clouds, visible sun shadows from the fountain, books, trees and NPCs, flagstone paving, distant conifers/hills and textured grass; night showed a deep blue gradient, stars and darkened clouds; the library showed plank flooring, ceiling beams and crown moulding under warm light. A `PCFSoftShadowMap` deprecation warning in three r187 was found in the console and corrected to `PCFShadowMap`.
- Quarters and Chamber of Numbers review (Chromium preview, 940×940, midday): both rooms were opened in the world and screenshotted from several angles. Before the changes the quarters had a black ceiling, a bare wall where the old glowing panel overlapped the mirror, a flat rug and a slab bed; the classroom had an untextured floor and only front ceiling lights. After the changes the quarters showed a lit ceiling with beams and moulding, a framed window with curtains to the floor, a panelled door under the exit prompt, wall sconces, the layered bed, the patterned rug and the framed print; the classroom showed plank flooring, the striped runner, the framed board and four framed ceiling panels lighting both ends of the room. No clipping or misaligned trim was visible from those views; the rooms still use point lights and ambient fill, so the far corners are dim rather than daylight-bright.
- Mobile pass (Chromium preview, 390 px wide, dev-only `?touch=1`): the gate showed four touch instructions and three full-width actions with no horizontal overflow. In the world, the location card, four HUD actions, 112 px joystick, Use/Jump column and prompt did not overlap at 390×940. Jump raised the camera from 1.66 m to 2.335 m and landed back at 1.66 m. The pause menu fitted in 620 px with 98–114 px rows, and the chat filled the viewport with its composer still visible (head 117 px, body 705 px, openers 40 px, composer 78 px) and 16 px input text. The host could not be shortened below 940 px, so landscape and keyboard-resize behaviour were not observed.
- In-world tutor chat (Chromium preview, logged-in learner): on the courtyard spawn the engine's nearest interactable was `companion:talk` labelled `Talk to Solenne`; `E` set the overlay and mounted the chat dialog. It loaded the latest conversation's two messages from the server, showed the courtyard openers (`Explain what I'm looking at`, `Who should I meet first?`, `What is the Chamber of Numbers?`) and a `Read aloud` button. Choosing the first opener sent the contextual sentence, the server appended it to the **same** conversation (id unchanged, 4 messages), and the panel re-rendered the server's messages. Clicking `Read aloud` started `speechSynthesis` (3 voices present, `speaking` true); `Esc` removed the panel, set `overlayOpen` false and restored the prompt `E Talk to Solenne`. The throwaway test conversation was deleted afterwards, leaving the learner's real thread untouched.
- Mouse-look fallback (Chromium preview, where pointer lock is denied): after *Step inside*, `locked` stayed false, `pointerLockBlocked` became true, the HUD switched to `Drag to look · WASD move · ← → turn …`, a one-time notice appeared, and no pause menu opened. A synthetic 220 px drag changed yaw by −0.748 rad (pitch −0.015) and restored the cursor state; holding `←` for 500 ms turned +0.512 rad without moving the player. Clicking the canvas again did not open the pause menu. Pointer-capture success and Esc-to-pause could not be exercised in this host.

## Known limitations / not implemented

- The art is deliberately low-poly and procedural: no imported models, image textures, post-processing (SSAO, bloom, colour grading) or real reflections. Flagstones and grass are canvas textures, so close inspection shows repetition.
- Shadows render only in the courtyard. Interiors rely on point lights and ambient fill, and large rooms can still read flat at the edges.
- Touch polish was checked in a 390 px-wide desktop viewport with the dev-only `?touch=1` flag, not on a real phone. Safe-area insets, software-keyboard resizing and real touch scrolling cannot be represented in that host, so those paths are implemented but were not observed. The preview host also kept an inner height of 940 px, so the short-landscape rules were not exercised.
- Frame rate was not measured meaningfully: the preview host renders WebGL in software and ran this scene at roughly 5–6 fps both with shadows (662 draw calls) and without (308). A real GPU will behave differently, but no desktop/mobile performance claim is made. `quality: low` disables shadows and caps pixel ratio at 1.
- Clouds are simple unshaded spheres and do not move with weather; stars are static points.

- Four spaces are playable: courtyard, Grand Library interior, personal quarters and the Chamber of Numbers classroom. The other requested locations exist only as sealed exterior landmarks, not interiors.
- The Chamber of Numbers is the only classroom. Lessons and books open as 2D panels over the 3D view; the lectern book is symbolic rather than a separate physical lesson object.
- The lectern uses the same lesson generator and endpoints as the rest of Asterwood; there is no classroom-specific curriculum or live teacher performance.
- NPC dialogue is authored, not AI-generated. NPCs do not yet remember individual conversations or develop relationships.
- Companion chat replies can be read aloud with the browser's speech synthesis (per reply and a voice toggle, with captions). Voice choice is a heuristic over installed voice names; if the system has no voice matching the tutor's gender, the best-ranked voice is used. There is no speech input, lip sync, or spoken dialogue from other NPCs, and whether a voice sounds right depends on the operating system's installed voices.
- With no AI key configured, `/api/tutor/chat` answers from the built-in curriculum engine. The in-world openers therefore share the same limitation as `/tutor`: a long contextual sentence may get a general clarifying reply instead of a description of the room.
- No real mirror reflection. The enchanted mirror opens the Asterwood Studio instead.
- No third-person cinematic scenes, photo mode or visible full player body in the world (first-person hands only).
- No inventory items, loot, 3D quest objects, XP awards from exploration, or study-room decoration yet; 3D discoveries are journal entries only.
- Dynamic weather is limited to the day/night cycle; there is no rain, snow or wind system.
- Ambient audio and music are not implemented.
- Some decorative props (benches, shelves, tables) are visuals without collision; NPC routes are hand-placed to avoid buildings but NPCs do not pathfind around obstacles.
- Mobile controls exist but 3D performance was not tested on real phone/tablet hardware. Touch devices now cap the render scale at 1.5× device pixel ratio and skip HUD blur passes; quality can still be lowered to disable shadows and cap at 1×.
- Mouse look uses pointer lock when a host allows it. When capture is denied (some embedded browsers deny it silently), the game falls back to drag-to-look, shows a one-time notice, and never pauses because of the failed request. Touch devices always use drag-to-look.
- No multiplayer, shared inventories or public chat, as required for the single-player design.

## Recommended next phases

1. More subject classrooms (laboratory, observatory, scriptorium) built on the same lectern flow.
2. NPC conversation memory and a safe server-side AI dialogue path, with authored fallbacks.
3. World quest objects, XP awards for genuine completion, inventory and room decoration.
4. Observatory and Great Hall interiors, then the grounds/forest expansion.
5. Real avatar body/cinematics, mirror reflection and photo mode.
6. Measured mobile performance pass with adaptive quality.
