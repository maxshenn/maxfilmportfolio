# Saved loaders

The homepage intro ("loading screen") lives in `index.html`. One loader is wired in at a
time — there is no loader switch.

## The current loader — the wall (2026-09-21)

A contact sheet of every clip in `public/loader`. The cells land one at a time, farthest from
the middle first, so the wall closes in and the last gap left is dead centre. The hero lands
in that gap at one cell's size — one more tile in the wall — then grows out over the wall
while the wall fades away underneath it, and rides on into the homepage.

It lives in `index.html` in the script commented "Cinematic intro driver — the contact-sheet
wall", with its CSS under the `si-*` notes.

`/?intro=1` replays it (it otherwise plays once per tab).

Things worth knowing before editing it — the full set is in `CLAUDE.md`:

- **Every clip is fetched up front, in reveal order — never staggered.** Giving each clip only
  a moment's head start before its own cell landed meant a first visit built a wall of stills
  while a cached reload built the same wall out of moving film. The reel is 5.5 MB; asking for
  all of it at once is what makes the first visit look like every visit after it.
- **The wall re-lays out when the viewport changes — height as well as width.** Opening a new
  tab hides Chrome's bookmarks bar a frame after load, so `innerHeight` grows. The panels and
  the hero track that by themselves; the cells are absolute pixels and do not, so a wall
  measured once ends up adrift of its own gap and leaves white above the hero. It is the
  reason this bug appeared on a first visit and never on a refresh.
- **`STAGGER` is the only pace dial.** The build runs `STAGGER × (cells − 1)`; every later
  beat keys off that. 34ms gives a 0.8s build, the white off the page at 2.3s and the
  intro out of the DOM at 3.0s. It ran at 58ms and that was too slow.
- **A key press must never skip the intro.** A deliberate tap or click does; a keystroke aimed
  at the browser — a modifier, a screenshot shortcut, a tab switch — is not a request to
  dismiss the page's own opening. Do not re-add a `keydown` listener.
- **The pull-back's smoothness is capped by the film, not the animation.** `hero.mp4` is
  23.976fps, so the 800ms expansion has ~19 pictures to show while the transform runs at the
  display's refresh rate (0 dropped frames, measured). Judder is how far the frame jumps
  between those pictures, so the curve keeps that jump small: `cubic-bezier(0.45, 0.05, 0.55,
  0.95)`, near-constant velocity like a dolly move — 89px worst jump against 224px for the
  ease-in-out it replaced. Do not put an ease-in-out back on this move.
- **The hero expands first; the wall fades underneath it as it grows.** `WALL_LAG` 150ms into
  the pull-back before the wall starts to go, `WALL_MS` 480, every cell on one clock. Measured:
  the hero starts growing at 33ms, the wall starts fading at ~198ms and is gone by ~533ms — so
  the frame pushes out over its neighbours for a beat and a half before anything dissolves, and
  is still moving when the wall has gone.
- **The hero is the page's own `.hero-media`, lifted above the whole intro and cropped to its
  slot with `clip-path`.** `z-index: 10001` against `#siteIntro`'s 10000, plus an `inset()` clip
  in the frame's own coordinates. Nothing is duplicated and nothing is cut out of the white for
  it to show through: the clip rides on the frame and scales with it, so growing the frame grows
  its window — the whole tile scales up, picture and all, like every tile beside it — and because
  the clip is on the film, what shows inside the window is film and nothing else.
- **The four white cover panels are gone**, and with them `openTo()`, `panelEase()`, the
  `.si-plug` plate, `#siteWall`, `--si-hero-from`, `--si-out` and `--si-out-ease`. They were a
  full-screen opaque mask with a hole in it, and that hole was the hero's slot — which meant the
  cells had to sit *above* the panels to be seen at all, and therefore above the hero. Every
  earlier compromise came from that one fact: a cell still visible where the hero had grown
  painted on top of the film. Lifting the hero instead removes the constraint rather than
  scheduling around it, and there is now nothing to schedule: a cell may fade for as long as it
  likes. The versions that tried to schedule around it — stagger the fade by distance, shorten
  the middle cells, move the wall below the hero (**the panels then hid it completely and the
  intro was a blank white screen**), and lead the fade far enough ahead to be safe (a dead beat
  before the expansion) — are all in the history and none of them worked.
- **The lift depends on nothing between `.hero-media` and the root creating a stacking context.**
  `.hero-section`, `body` and `html` are all plain today. Give any of them a transform, a filter,
  `isolation` or opacity below 1 and the hero is trapped under the intro: invisible for the whole
  build, snapping in at the hand-off. `html.page-enter body { opacity: 0.01 }` is the near miss —
  harmless only because `page-enter` is skipped while the loader owns the reveal.
- **The clip leans 0.02px inside the slot.** The compositor resolves a clip edge to the whole
  device pixels it touches, so an edge at 857.99 rather than 858.00 takes the pixel above with
  it — which showed as one gutter beside the hero measuring 11 device pixels where every other
  was 12, on a 3x phone. Leaning inward decides the rounding; the 1.005 cover keeps film under
  the clip either way.
- **Check five things after touching any of this:** the hero starts growing before the wall
  starts fading; `elementFromPoint` at the centre of the hero's own window returns `hero-video`
  on every frame the wall is visible; the opacity spread between any two cells is ~0; 24 cells
  are visible at peak; and every gutter around the landed hero equals the gutter between any two
  cells, with all the full-width white bands in a screenshot coming out the same number.
- **The wall's videos pause when the dissolve starts**, so 24 H.264 streams stop competing
  with the 1080p hero at the one moment a dropped frame would be seen.
- **`OUT_MS` and `EASE_PULL` are applied inline to the one element that moves.** The clip opens
  and the transform returns home on the same duration and the same curve, on the same element,
  so the window cannot outrun the film or fall behind it. The old design needed two CSS custom
  properties to keep a separate window in step with the frame; there is no separate window now.
- **The grid is snapped to whole pixels once**, and the hero's gap is cut from the same edge
  table as the cells. If they are rounded separately the hero ends up sitting in a wider band
  of white than its neighbours.
- **The hero lands like any other cell**: held in its slot at 0.9 and opacity 0, then crossing
  over `FADE_MS` while the tile grows its last 10% over `CELL_MS` — the two moves `land()` makes.
  The lift and the hiding happen in the same task, so there is no frame in which the full-size
  frame could flash over the wall. Two failures from the old hole-and-plate design, kept because
  both are easy to reinvent: irising the slot open from a point made the hero grow into an
  oversized white slot instead of filling it, and easing the four panels rather than jumping
  them punched the gap a quarter open in a single frame.
- **The only pause is after the wall is whole**, not before the hero and not after the wall
  goes. The hero takes the last turn in the stagger, one beat after the final cell; the wall
  holds for `PAUSE`, and then the hero pulls back out of it while the wall fades away beneath.
- **The hero's slot is a cell of the grid — same size, same gutters, cover-cropped like every
  other tile.** Fitting its whole 16:9 frame inside the cell instead leaves the slot short and
  puts double the gutter above and below it, which reads as the hero sitting unevenly among
  the other frames. Check any change by scanning a screenshot for full-width white rows: every
  row gutter must be the same number.
- **The four clips touching the hero must have DARK edges facing it.** The gutter is white, so
  a bright facing edge merges with it and the pair read as one band — the hero then looks like
  it is sitting low in its slot even when the grid is exactly even. Measured off the stills,
  not judged by eye.
- **The `CLIPS` order is the layout, and it was solved rather than chosen.** The reel holds
  real look-alikes (`morocco-2` and `st-bernard` are both dogs, `couple` and
  `fish` the same lake at the same dusk, three separate horse clips, and `valley`/`village`/`st-bernard`/`waterfall` are one Dolomites trip). The
  shipped order keeps every such pair at least three cells apart on both the 5×5 and the
  phone's 3×7. Adding clips means re-solving it, not appending to it.
- **There are no duplicates, and there should not be.** The pool is 24 clips and the 5×5 has
  exactly 24 clip cells, so every frame appears once. The phone's 3×7 has 20 cells and draws
  `CLIPS[0..19]`, so the last four do not appear there — keep anything new inside the first 20.
  Add a 25th clip without re-solving and the wrap returns and something repeats.
- **Never put the gate's prefetched `Image` element into a cell.** A DOM node lives in one
  place, so two cells sharing a clip would move it out of the first, leaving that cell
  on its bare tone colour. The prefetch is a cache warmer; each cell builds its own `<img>`.

## Snapshots in this folder

Whole-page copies of `index.html` taken when a loader was retired. They are a reference /
last resort: restoring one wholesale would also roll back every other homepage change made
since, so prefer lifting just the driver script and its CSS out of one.

- `orbit-sphere-2026-09-21-index.html` — the orbit loader on the current homepage, taken the
  moment before the wall replaced it. **Use this one** to get the orbit back; it is the only
  snapshot that carries the phone frames/projects work.
- `orbit-sphere-index.html` — the same loader on the 2026-09-19 homepage. Kept for history.
- `film-wheel-index.html` — the older "film wheel" loader (2026-09-10).

(Snapshots use paths relative to the project root, so copy one to the root to run it.)

## Note on the butterfly loader (2026-09-21)

A butterfly whose wings were filled with the loader clips, in two variants (one that sketched
the hero frame, one that opened into it with a single flap), was built and then lost to a bad
edit before it was ever committed. It is not recoverable from this folder — every snapshot
here predates it. If it is ever rebuilt, the research that informed it concluded:

- Author the butterfly rather than generating it. A matte needs fractional alpha on motion-blurred
  wing edges, which a rendered frame computes and a generated one only approximates.
- Deliver it as a stacked matte in one ordinary H.264 file (colour above, luma matte below) and
  composite in WebGL. Transparent-video codecs split Chrome and Safari and are ~4.7x larger.
- `destination-in` with a luma matte silently fails, differently, in both engines.
