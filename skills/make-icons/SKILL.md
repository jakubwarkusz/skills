---
name: make-icons
description: "Draws interface icons that belong to the set a project already has, or to a style agreed first when it has none. Use when someone asks for a new icon, a badged or sized version of one, a whole set, icons redrawn in one style, or says icons look off: wrong size, uneven strokes, a detached arrowhead, a state that doesn't show. Asks for references before drawing when no style exists, draws a few icons at a time and measures each batch."
---

# Make icons

An icon is right when nobody notices it: it sits on the same grid, at the same weight and the same optical size as the icons next to it. Draw to the project's set first. Draw a few icons at a time, measure every one before calling it done, and look at it at the size people will see it.

## 1. Find the style

Before drawing anything, find the icons the project already has and read their rules from the code:

- Where they live (an `icons.tsx`, an `icons/` folder of SVGs, an icon library in `package.json`).
- Icons drawn inline in components: search the source for `<svg`. They are part of the set. To audit them, copy each one's markup into an `.svg` file in a scratch folder, named after the component and what it shows (`SelectCheck.svg`), and audit that folder together with the icon file's icons. Why: the icon file is the part someone already kept consistent; the second check mark, with a different angle, is in a component. One project had six check shapes, one in its icon file and five inline.
- The grid (`viewBox`), the stroke width, the caps and joins, the corner radii.
- Line, filled, or filled with cut-outs, and how cut-outs are made (a mask, `fill-rule`, overlapping shapes).
- How colour reaches them (`currentColor`), the sizes they're shown at (search the code for the size classes), and how a selected or pressed state shows.

Run the audit (step 6) on the existing set; with no icons in the project there is nothing to run, go to step 2. The numbers it prints are the spec: the stroke width, how big a filled shape is, how big a line icon is, where the centre sits.

Review the set while reading it, and report what you find before adding to it:

- The same idea under two names (Close and X, Trash and Delete). The audit flags identical drawings as `twin`.
- Icons nothing imports.
- Icons on a grid of their own, or with a `viewBox` cropped to the drawing.
- A container that means two things (a circle around a status in one icon and around an action in another).

Don't delete or redraw any of these without asking, and don't wait for the answer to draw what was asked: the report goes with the first sheet. Why: a new icon copies its neighbours, so a set with duplicates and strays teaches the wrong numbers, and removing an export breaks code you haven't read.

If the set uses a library (Lucide, Phosphor, Heroicons, Material Symbols), new icons come from that library first. Draw one only when the library has nothing for the idea, and draw it to the library's rules.

## 2. No style yet: ask first

When the project has no icons, or the ones it has disagree with each other (the audit finds no majority stroke, or there are two techniques, such as outlines beside filled shapes, with neither clearly the set), don't pick a style on a guess. A set with one clear style and a few faulty icons is a style: follow it and report the faults. Ask, in one message:

- Line, filled, or filled shapes with cut-out details?
- Which grid (16, 20 or 24) and which sizes they'll be shown at.
- Rounded or square ends and corners.
- Two or three references: a screenshot of a product whose icons they like, an icon set, or the project's own logo and type to match.
- Which icons are needed now.

If they have no preference, propose the spec in step 3 as it stands (16 grid, filled shapes with cut-outs, round ends), changed only where their answers or the product's type and corners call for it, with a sheet of three of the needed icons, and wait for a yes before drawing the rest. Until the yes the three stay on the sheet: don't wire them into the app. A reference gives the style, never the drawings: don't trace or copy icons from another product or a set with a licence that doesn't allow it.

## 3. Write the spec

Three to six lines, kept next to the icons or in the conversation, and followed by every icon:

```
Grid 16, live area 13 (1.5 margin), shown at 14 to 20 px. Stroke 1.5, round caps and joins. Icons that are only lines 1.75.
Filled shapes for objects, details cut out at 1.25. Lines for actions (arrows, close, plus) and for objects that are a line by nature (a magnifier, a link, a paperclip).
Filled shapes reach 12 to 13, line icons 9.5 to 12. Centred on the grid within 0.25.
Badges bottom right, radius 3.5, ring 1.
Colour from currentColor. Selected state shows on the button, not in the drawing.
```

Put the numbers in `icons.audit.json` beside the icons too, so the audit holds every icon to them instead of to the majority:

```json
{ "spec": { "16": { "stroke": 1.5, "line": 1.75, "cut": 1.25, "gap": 1 } } }
```

- `stroke` is the line width, `cut` the width of cut-out details, `gap` the smallest space allowed between two parts.
- `line` is the stroke of icons that are only lines, in a set where most icons are filled (see Strokes). Leave it out in a set that is all lines, and in an existing set whose line icons use the set's stroke.
- For a set that already exists, write the numbers the audit printed for it, not these. Leave `gap` out when its icons have tighter gaps than 1 (the audit then allows down to half a unit), and report those icons instead of redrawing them.
- One entry per grid when the set has drawings for several sizes (`references/sizes.md`).

Why: with no spec the audit takes the most common width as the rule, and in a small or new set the most common width can be the mistake.

## 4. Work in small batches

Never draw a whole set in one pass, however clear the list is.

- Start with three anchors: one filled object, one line action, one icon with a cut-out or a badge. Take them from the icons that are needed; when the list has no line action or no cut-out, take the three that differ most from each other instead of drawing one nobody asked for. Take them through step 6 and show the sheet. With a new style, wait for a yes. With an existing set, the icons already there are the anchors; when the new icons bring a construction the set doesn't have (a ring, a dashed line, a pie), draw the first of them alone, settle its numbers on the sheet, and treat it as the anchor for the rest. Why: every later icon copies the anchors, so a wrong stroke or size caught here is fixed once instead of in forty drawings.
- Then at most five icons at a time, related ones together (a family, the badged versions of one base). A family turned or mirrored from one drawing counts as one; icons that only share a part (six states in one ring) count each. Why: attention per icon falls with every icon in the pass; the tenth gets its numbers by habit, not by looking.
- One icon at a time inside the batch: the idea, the outline, the details, then the next icon. Why: paths written side by side borrow each other's coordinates, and the borrowed ones are off by the difference between the two shapes.
- After each batch render it together with the icons already accepted, run the audit, open the sheets and fix every flag before starting the next batch. Why: a fault left in is copied into the next batch, and a sheet of forty icons hides what a sheet of five shows.
- For a long list, say the order, deliver batch by batch, and show the sheet after each. A change the person asks for goes back into the anchors and the spec first, then into the icons already drawn.

## 5. Draw

### The idea
- One idea per icon. Draw the object or action people already know, with as few parts as it takes. Why: detail that doesn't survive 16 px is noise; recognition comes from the silhouette.
- Use the picture people have learned: a magnifier for search, a bin for delete, a gear or sliders for settings. Invent a picture only for an idea that has none. Why: a new metaphor has to be learned, and a known one is read without a label.
- Different ideas have different outlines. Two icons of the set must stay apart when only their outer shape is seen. States of one thing in one container are the exception: they share the outline on purpose, so the difference inside has to be large, an empty, a half and a full shape and not two fills a quarter apart, and has to hold without colour. Why: at a glance and at 16 px people read the outline; a detail inside is seen second or not at all.
- One viewpoint. Objects are drawn flat and from the front, with no perspective and no shading, unless the whole set does otherwise. Why: one tilted object among flat ones reads as a different set.
- A recurring container means one thing. If a circle holds states (done, failed, waiting), an action doesn't go in a circle. Why: people learn the container as a category and read the wrong one.

### Grid and size
- One grid and one live area. Every icon uses the same `viewBox` and keeps a margin so strokes and round caps don't clip. Why: icons from different grids scale to different weights at the same CSS size.
- The frame is fixed. The `viewBox` is `0 0 grid grid` on every icon: never cropped to the ink, never shifted to nudge the drawing. A drawing that sits wrong is moved in its coordinates. Why: a cropped frame scales that icon up beside the others, and a shifted one moves it for everyone who uses the component.
- Size by optical weight, not by box. A filled circle or square reads larger than a cross of the same box, so filled shapes sit near the live area while lines and arrows stay smaller. A close cross matches the plus beside it at about seven eighths of its box, 10.5 across where the plus is 12. Looked at in a toolbar row: at 9, the plus's own arms turned, the cross is small, and at 12 it is bigger than the plus. Why: equal boxes look unequal; people judge size by how much ink they see.
- Start from the keylines. On a 16 grid with a 13 live area: a circle 13 across, a square 12, a wide shape 13 by 10 to 11, a tall one 11 to 12 by 13. The 13 is for extremes that are round or pointed (a circle, a roof tip, an arrow head): a 13 centred on 16 ends on 1.5 and 14.5, between pixels, which a curve hides and a straight edge doesn't. A long straight edge stops at 12 (from 2 to 14). On other grids scale them. They are where the outline's extremes aim, not boxes to fill: an icon whose idea is small (a chevron, a dot) stays small, and nothing goes past the live area. Why: a circle and a square of equal width don't look equal; these boxes give the four basic shapes the same visual weight.
- States of one container share its outline. A ring, a part-filled ring and a full disc that stand for the states of one thing (to do, in progress, done) are the same circle at the circle keyline, also where the ring alone is a line icon; when the full disc then looks a size larger in the row, take a quarter unit off its radius. Why: the row is read as one mark filling up, and a ring drawn at the smaller line size beside its own filled state reads as a different control.
- Line icons beside filled ones sit at the top of the line range. In a row of actions (copy, vote, retry), a line icon among filled ones needs nearly the box of its neighbours, about 12 on a 16 grid. Why: a line icon carries less ink, so at the median line size it looks smaller and greyer than the filled icons beside it.
- One drawing serves the sizes near its grid: a 16 grid holds from 14 to 20 px. An icon shown at 12 or at 24 px and above gets its own drawing on that grid; read `references/sizes.md` first. Why: scaling scales the stroke. A 1.5 stroke is 1.1 px at 12 px, where 1.25 cuts smudge shut, and 2.25 px at 24 px, where the icon reads bold beside its label.

### Construction
- Build from primitives: rectangles with a radius, circles, straight lines and arcs (`a` with one radius). Write a free curve only for a shape that isn't one of these, and then put its control points straight above, below or beside the points they belong to. Why: primitives are exact and symmetric by construction; hand-typed curves wobble, and the wobble shows at 2x.
- Symmetry by arithmetic. A shape mirrored on the middle of a 16 grid has every point at x and 16 minus x. Check the sums before rendering. Why: a mirror that is off by a quarter unit puts a blurred edge on one side only.
- Corners are concentric. A corner inside another has the outer radius minus the distance between them; when that reaches zero it is square. Why: equal radii on both make the band between them thick in the corner and thin on the sides.
- Diagonals at 45 degrees. When the idea needs another angle (the slant of an italic, a pen), every icon with that kind of line uses the same one. Why: 45 degrees steps evenly on the pixel grid; a mix of near-45 angles looks like a mistake.
- The same part is the same numbers. Lines on a document, dots, arrowheads have one length, spacing and radius across the set. Keep them as shared constants in the code. Why: two files whose text lines differ by half a unit look like two hands drew them.
- A glyph inside another icon is the set's own icon, scaled. The check in a success circle or on a badged file is Check, the plus in UserPlus is Plus. Never redraw it by eye. Why: a redrawn check has a flatter arm or a different corner than the set's Check, and the two appear on the same screen. This is the detail people notice without knowing what they noticed.
  - Take that icon's path, multiply its coordinates by one factor around the middle of its grid (8 8 on a 16 grid), move that point to the middle of the disc or badge, and keep two decimals. The factors are in `references/badges.md`.
  - When the set has no such icon yet (a cross but no Close), draw that icon first, as an icon of the set.
  - Name the icon after the glyph (FileCheck, UserPlus), so the audit compares the two.

### Strokes
- One stroke for the set. Pick it once (1.5 on a 16 grid is common) and use it for every outline and for every line that is part of a filled icon. The only other line width is the `line` stroke below. Why: a single heavier icon looks bold in a toolbar of regular ones.
- Icons that are only lines take one step more in a set where most icons are filled: 1.75 where the filled shapes use 1.5. That goes for a plus, a check, an arrow, a close cross on their own, not for the same glyph inside another icon. Why: a plus or an arrow has no body to carry weight, so at the set's stroke it reads lighter than the filled icons beside it. Measured on a 16 grid: 1.75 matched them, 2 read bold.
  - Decide it once, write it in the spec as `line`, and use it on all of them.
  - In a set that is all lines there is one stroke and no `line`.
  - An existing set keeps what it has until the person agrees to change it.
  - The outline twin of a filled icon (MailOutline beside MailFill) keeps the set's stroke, so both fill the same box.
- One width for cut-outs. Details cut out of filled shapes (envelope flap, lines on a document, a keyhole) share one width, a little thinner than the stroke. A glyph cut out of a disc that it fills, the check in a success mark or the cross in a failure, is not a detail but what the icon shows: it is cut at the stroke. The audit holds both. Why: thinner cuts close up at 16 px; mixed cuts make filled icons look uneven. Measured at 16 px on a 1x screen: a cross cut at 1.25 breaks into five pieces, at 1.5 it stays whole.
- Ends join what they belong to. An arrowhead starts where its line or arc ends and points along it; a hook meets its stem. Draw them as one path when you can. Why: a head that floats beside its arc reads as a stray mark, and it's the first thing people notice on a retry icon.
- Open the angle where strokes meet. The arms of an arrowhead leave the shaft at 45 degrees; nothing meets under 30. The audit flags ink that pools to over twice the stroke. Why: strokes that meet at a narrow angle run together into a wedge, and the tip looks heavier than the rest of the icon. At 45 degrees the tip measures 1.7 strokes, at 20 it passes 2.
- Look at junctions on a dark background. When a tip, a crossing or a tight ring glows heavier in the dark rows of the sheet, shorten the arms or open the angle. Why: light ink on dark spreads, so a junction that passes on white can still clot on black.

### Shapes and cut-outs
- Filled with cut-outs via one technique. Use the project's method; with none, a mask: white shapes and strokes for ink, black for cuts, then fill a rect with currentColor through the mask. Why: stacking a background-coloured stroke on top fakes a cut that breaks on any other background. The examples in this skill and its references use this wrapper and these cut props; where the project has its own, use those:

  ```tsx
  type IconProps = ComponentProps<"svg">;
  const cut = { fill: "none", stroke: "black", strokeWidth: 1.25 } as const;

  function Solid({ children, ...props }: IconProps) {
    const mask = `icon-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
    return (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden {...props}>
        <mask id={mask}>
          <g fill="white" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {children}
          </g>
        </mask>
        <rect width="16" height="16" fill="currentColor" mask={`url(#${mask})`} />
      </svg>
    );
  }
  ```
- Gaps survive the smallest size. A cut, a gap between two parts or a counter is at least one cut width wide at the grid size: that is the number to draw to. The one exception is the ring round a badge, which may go down to 1, and that is why the spec's `gap` is 1 and not the cut width: the audit flags only under `gap`, so a gap between 1 and the cut width passes it and is yours to widen. Why: at 16 px on a 1x screen, anything thinner turns into a smudge.
- A cut that reaches an edge runs well past it. A door, a slot or a notch drawn as a round-capped cut ends at least one cut width outside the shape (a door in a house whose ink ends at 14 is `M8 10.5v5`, not `M8 13.5v-3`), so the round cap lies wholly outside and the end on the edge is flat and open. The inner end keeps its round cap. Why: a cap that ends on the edge or a hair past it crosses the edge with its curve, and leaves two small rounded corners of ink at the foot of the door. They are the first thing seen in an otherwise clean icon.
- A cut ends inside the shape or runs clean through its edge. It never stops a hair short of the edge, and it never leaves a loose crumb behind. Extend the cut past the edge, or pull it back by at least the cut width. Why: the leftover is a sliver thinner than a pixel that flickers between sizes; a meridian that stops just under a globe's edge leaves a hairline across each pole.

### Families, layers and variants
- Families share their numbers. Arrows in four directions, chevron up and down, thumbs up and down are one drawing turned or mirrored with a transform, never redrawn. Why: redrawn pairs drift by half a unit and the difference shows when they sit side by side.
- A badge, a slash or a dot is a layer over a base that stays where it is. Name the icon as the base plus the layer (FilePlus, BellOff) only when it is that: the audit reads the name, looks for the base's ink under the layer and for the glyph's path, and flags an icon whose name promises what its drawing doesn't have. A state mark that is not its base plus something is named after the state (StatusDone, not CircleCheck beside a Circle that is a ring). Reuse the base's own shapes, and read `references/badges.md` before drawing one. Why: a base moved or shrunk to make room no longer lines up with the plain icon in the same list, and a ring drawn by eye is uneven.
- Outline, filled and duotone versions of one icon are built from the same parts; read `references/variants.md` before drawing a second variant. Why: versions drawn separately differ in size and position, and the icon jumps when one replaces the other.
- Compose in the source, ship flat. Shared shapes are constants in the icon file; every exported icon is one static svg, not a component that assembles layers from props. Why: composing at runtime ships the composer and every layer to the page, and an icon that only exists once assembled can't be audited as a drawing.

### Alignment
- Centred on the grid. The ink's bounding box is centred within a quarter unit. Why: off-centre icons look misaligned with their label or inside a square button.
- Optical exceptions are deliberate. A play triangle moves right of centre, a warning triangle sits a little high, so their visual weight is centred. Record them as exceptions (step 6). Why: geometric centring makes triangles look like they lean.
- Coordinates on quarter units, outer edges on whole ones. Why: an edge on a pixel boundary is sharp at 1x; an edge in the middle of a pixel is a grey line, and the icon looks soft beside sharp ones.
  - Keep points on 0.25 steps. What follows from arithmetic is exempt and keeps two decimals: a scaled glyph, the end of an arc, a dash length that has to divide a circle.
  - Place straight outer edges so the ink ends on a whole unit. With a 1.5 stroke the line's centre is 0.75 inside the edge (2.75 for an edge at 2). With a 1.75 line it is 0.875, so put that line's centre on the nearest quarter (2.75 or 3) and let the audit's size column tell you which matches the other icons.
  - A horizontal or vertical cut is centred on a half unit (8.5, not 8), so it covers one whole pixel row and shares the rest evenly. A cut on the icon's axis of symmetry (a door in the middle of a house) stays on the axis.
- Fix position in the drawing. No `translate`, margin or `top: 1px` on the component to make an icon sit right. Why: the nudge fits one place; the next place the icon is used gets the unfixed drawing.

### States and use
- State shows on the control. This is about one control in two states, not about icons that each stand for a status in a list. Selected, pressed or voted states change the button's background, colour or the other options' opacity. A short scale pop (around 300 ms, skipped under reduced motion) can confirm the press. Why: swapping an outline for a filled drawing changes weight and size, and a filled-only set has no outline to swap to.
- Colour comes from currentColor. No hard-coded fills or strokes in the drawing, except the black and white inside a mask. Why: the icon then follows text colour, hover, disabled and dark mode for free.
- Decorative by default. `aria-hidden` on the svg; the button or link carries the label. Why: screen readers otherwise read nothing useful, or read it twice.
- Never typed symbols. Arrows, the return sign, check marks and the command key are drawn, not typed. Why: typed symbols take the font's weight and baseline and never line up with drawn icons.

### Code
- Unique ids per instance. Mask, clip and gradient ids come from `useId` (or a counter), never a fixed string. Why: two icons with the same id on one page both use the first one's mask, so every icon shows the same drawing.
- Size from CSS. The svg takes its size from the class (`size-4`), not from width and height in the drawing. Why: one component then serves every size near its grid.
- Keep the API. When redrawing a set, keep the export names and props so the rest of the code doesn't change.

## 6. Check

Render the icons into one page and audit them, after every batch:

```
node <skill>/scripts/render_icons.mjs out/icons.html src/icons.tsx [--root <dir>]        (React icons)
node <skill>/scripts/audit_icons.mjs <out/icons.html | icons-folder | icon.svg> [--grid 16] [--out <dir>] [--exceptions <file>]
```

- A folder of `.svg` files or a single `.svg` works as is.
- The audit reads `icons.audit.json` from beside the page, or from beside the first icon file the page was rendered from, or from `--exceptions`. Its first lines say which file it used; check that they do.
- The render script needs Node 22.15 or newer and is run from the project root. It puts every exported component whose name ends in `Icon` into one tree, each in `<div data-icon="Name">`. When you render them yourself, keep that: one `renderToStaticMarkup` call for all. Why: rendered one by one, every icon gets the same `useId`, so the sheet shows one drawing many times.
- It compiles `.tsx` with a compiler the project already has (typescript up to 6, esbuild, @swc/core or sucrase). When it finds none it says so: install esbuild in a scratch folder outside the project and pass `--root <that folder>`, the same folder the audit can take.
- Icons that aren't React components (Vue, Svelte, plain SVG) are audited as a folder of `.svg` files.
- The audit needs Playwright and a Chromium. When either is missing it says which and prints the command to install it. Installing it adds a dev dependency to the person's project: ask first, or install it in a scratch folder outside the project and pass `--root <that folder>`. Then audit again. Don't skip the audit because it didn't start.

The script prints, per icon, its ink box, centre, the gaps and counters that survive, and the stroke widths it uses. It flags:

- `stroke`, `cut`, `ends`: a width, cap or join that isn't the set's or the spec's. `cut` also names a glyph that is the icon's subject and is cut thinner than the stroke. `weight`: an icon drawn as outlines whose lines measure thicker or thinner than the stroke.
- `centre`: a box more than 0.25 off the middle. The `weight centre` column beside it is where the ink balances; it is not flagged on its own, because a house or a lock is heavier at the bottom by nature. Act on it only when the icon also looks low or high in the rows. `size`: a box well outside the icons of its kind. `clip`: ink touching the frame. `grid`: a frame that isn't the set's, isn't square or doesn't start at 0 0.
- `counters`: an enclosed gap (a keyhole, the lines on a document) that closes or breaks apart at the grid size on a 2x screen. The `gaps 2x/1x` column reads `1/3 of 1`: the drawing has one enclosed gap, a 2x screen shows it as one, a 1x screen breaks it into three. Only the first number is flagged. When the second differs, look at the pixel view: a cut-out glyph on a diagonal (a check, a cross) always breaks up at 1x and is left alone as long as it still reads; a straight cut that closes is moved onto a half unit, and when the icons are mostly used on 1x displays the set's cut width is raised in the spec for all of them, never for one icon.
- `gap`: two edges closer than the spec's gap. `thin`: a sliver of ink under half a unit. `cap`: a round-capped cut that ends on an edge and leaves rounded corners of ink beside the opening. `speck`: a loose crumb left by a cut. `pool`: ink over twice the stroke thick where lines meet.
- `ring`: a gap between two parts that isn't one width all the way round, as around a badge.
- `family`: icons named as turns of one drawing that aren't. `layer`: an icon named as a base plus a badge or slash whose base moved. `variant`: outline and filled versions with different boxes. `scale`: drawings for different sizes that fill their grids differently. `twin`: one drawing under two names. `glyph`: an icon named after a line icon of the set (FileCheck after Check) that doesn't contain that icon's path scaled.
- `colour`: paint that isn't currentColor. `id`: an id shared with another icon.

When the set has no majority stroke or cut width and no spec, it says so instead of guessing which icons are wrong: that's a style question for step 2, not a fix. It exits 1 when anything is flagged. Fix every flag in the drawing, unless it is one of the exceptions below, and run it again until it prints `nothing flagged`. Flags on icons that were there before you started are not yours to fix or to except: note them when you first run the audit, leave them, and you are done when no flag is left on an icon you drew or changed and the old ones are in the report.

Then open what it wrote and look. A clean audit says the numbers agree; it can't say the icon is good.

`sheet.png` (and `sheet-2.png`, `sheet-3.png` and so on past 24 icons; open them all): every icon large on its grid, as the pixels a 1x screen gets, and at 1x and 2x size. Flagged names are orange, accepted ones blue. The large view carries the drawing aids: the centre lines, the live area and circle keyline in blue, the square, wide and tall keylines in pink, and under a badged or slashed icon, in red, the ink of its base that the icon no longer has. Use it while drawing, not only at the end: render a half-done icon and read off which keyline it should reach and which grid line an edge missed.

On the large view:

- Does the outline reach the keyline of its shape, and does every straight edge sit on a grid line?
- Under a badge or slash, is red showing only inside the ring and the layer? Red along an outer edge means the base moved.
- Are curves round and mirrored halves equal?

On the pixel view and at the 1x size:

- Does each icon say its idea at the 1x size, without the name under it?
- Squint at the row: is any icon darker, lighter, bigger or smaller than its neighbours?
- Are straight edges one clean row of pixels, and are the cuts still open?
- Is any part floating, touching what it shouldn't, or ending in a hairline?

`rows.png`: the icons in a toolbar and beside 13 px labels, light and dark.

- Does each icon sit on the middle of its label, or does one ride high or low?
- Is the icon's line about as heavy as the letters, or does the row look like bold icons with light text?
- In the dark rows, does any junction or small ring clot?

Fix what you see in the coordinates and audit again. Last, look at the icons where they're used, in light and dark, in each state.

### Exceptions

Some icons are right only when they break a number. Those go in `icons.audit.json` beside the icons, one entry per icon and check, with the value the audit measured and the reason:

```json
{
  "exceptions": [
    { "icon": "Play", "check": "centre", "value": [0.88, 0], "reason": "A triangle centred by its weight, not its box." },
    { "icon": "Bold", "check": "stroke", "value": 2, "reason": "The heavier line is the meaning: it marks bold text." }
  ]
}
```

An exception covers that value only. When the icon changes, the flag comes back; when nothing matches an exception any more, the audit calls it stale and fails until it's removed. A centre exception is also tested: it only holds when the icon's weight sits nearer the middle than its box does.

Only these are exceptions:

- Optical centring of a shape whose weight isn't in its box: triangles (play, warning), a speech bubble with a tail, an arrow with a heavy head.
- A glyph that is small by nature, when the audit flags it. Chevrons, carets and dots are not flagged for being small as long as their name says what they are; a chevron's arms are 4 long on a 16 grid (9.5 across with the stroke), 3.5 where it is shown at 12 to 14 px.
- A weight that is the meaning: bold in a text toolbar draws a heavier line than the rest, because a B at the set's stroke reads as regular.
- A brand mark, kept on the grid and in the shape its owner supplies (`grid`).
- An old name kept as an alias of a new one while code still imports it (`twin`), or a name that only looks like a base plus a layer (`layer`) or like it holds a glyph (`glyph`).

Everything else is fixed in the drawing: a stroke that differs, a box too small next to its neighbours, an arrowhead off its line, a centre that is just off. A gap that closes, a sliver, a crumb, a cap that ends on an edge, an uneven ring, clipped ink and a shared id can't be excepted at all. Never add an exception to make the audit pass. Each new one goes in the final report with its reason, and when the set is new or the person hasn't seen it yet, they confirm it first.

## When done

Report what was drawn or changed, the spec followed, the audit result, every exception added or changed with its reason, and what was checked by eye and at which sizes. Attach the sheets.
