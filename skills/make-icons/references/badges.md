# Badges, slashes and dots

Read this before drawing an icon that is another icon plus something: a file with a plus, a bell with a slash, an inbox with an unread dot. The numbers are for a 16 grid; `sizes.md` has the other grids.

## Three parts

Every such icon is the base, a knockout and the layer, in that order. `Solid`, `cut` and `IconProps` are the mask wrapper and cut props from `SKILL.md` (Shapes and cut-outs), or the project's own:

```tsx
const file = <path d="M4.25 2.75h4.5l3 3v7.5h-7.5Z" />;

export function FilePlusIcon(props: IconProps) {
  return (
    <Solid {...props}>
      {file}
      <circle cx="11" cy="11" r="4.5" fill="black" stroke="none" />
      <circle cx="11" cy="11" r="3.5" stroke="none" />
      <path {...cut} d="M11 9.25v3.5M9.25 11h3.5" />
    </Solid>
  );
}
```

- The base is the plain icon's own shapes, from the same constant, where the plain icon has them. It is not moved, shrunk or redrawn to make room. Why: FilePlus sits in the same list as File; a base that shifts by half a unit makes the column of files look ragged. The audit compares the two outlines and flags a base that moved (`layer`).
- The knockout is the layer's own shape, grown by the ring on every side, in black: a circle with the badge's centre and its radius plus the ring, or the slash's path with its stroke plus twice the ring. Never a shape placed by eye. Why: a ring is seen as even or uneven before anything else about the icon is seen, and only a concentric shape gives the same width all round. The audit measures it (`ring`).
- The layer is drawn last, over the knockout.
- The ring is 1 on a 12 and a 16 grid and 2 on a 24 grid. A spec `gap` of 1 holds it on the small grids. Why: under one pixel the ring closes on a 1x screen and the badge melts into the base.
- Name the icon as the base plus the layer: FilePlus, BellOff, InboxDot. Why: the audit finds the base by the name, checks it stayed in place, and then judges the centre by the base, because a badge hangs off one corner on purpose.

## Badges

- One corner for the whole set, bottom right unless the set already does otherwise, with the disc's right edge on the live area (centre x 11 on a 16 grid) and its bottom edge on the base's bottom edge (centre y is the base's bottom minus 3.5: 10.5 under a base that ends at 14). Why: badges at different heights across a row of files read as different kinds of badge, and a badge that hangs below its base gives the badged icon a lower bottom line than the plain one beside it in a list.
- A badge that holds a glyph is a solid disc of radius 3.5. Why: measured at 16 px, the plus inside a disc of radius 3 closes on a 2x screen; at 3.5 it stays open on 1x.
- The glyph inside is the set's own icon, scaled by one factor, as `SKILL.md` says under Construction: never redrawn, and never rounded to the quarter grid, which is the one place the quarter rule gives way. Why: the audit compares the two (`glyph`). A check rounded to quarter units was 1.8% off and visibly flatter, the scaled one 0.1%.
  - In a badge of radius 3.5 the glyph with its cut is about two thirds of the disc across: a factor of a third for Plus (arms of 1.75), 0.34 for Check, and for Close the factor that gives it the arms of that Plus. It is cut at the cut width.
  - In a disc that fills the icon it is about half: 0.6 for Check, and a cut of the full stroke instead of the cut width, since the glyph is now the icon's subject.
  - In both, at least 0.75 of ink stays between the glyph's ends and the disc's edge.
  - When the set has no such icon yet (no Plus, no Close), draw that icon for the set first and say so in the report.
- Only glyphs that survive: plus, minus, check, cross, a dot, an arrow. A lock, a gear or a clock inside a badge is a second icon; draw that idea as its own icon or as the base. Why: seven pixels hold one stroke and its gaps, not an object.
- A base detail that the ring would touch or cut is removed whole, never shortened. Only details that stay whole, with a full cut width of ink between them and the ring, are kept; when that leaves the base with none, it has none. Why: half a text line beside a badge is a stub that reads as a stray minus sign, and the eye goes to it before the badge. The outline already says "file"; the badge says the rest.
- In a line set the badge is the bare glyph over the knocked-out corner, at the set's stroke, or a solid disc with the glyph cut out. Not an outlined disc with a glyph inside. Why: measured at 16 px, the outlined disc leaves 0.5 between its ring and the glyph, and it fills in.

## Unread dots

- A solid disc of radius 2 with a ring of 1, centre 12.5 3.5: top right, no glyph. Why: a dot means "something new" by its place and nothing else; the top right corner is where people look for it.

## Slashes

- One line from corner to corner of the live area, top left to bottom right, at the set's stroke, the same two end points on every icon of the set. The round cap ends on the corner, so the path itself runs from 2.25 2.25 to 13.75 13.75 on a 16 grid. Why: slashes at different angles across mic-off, bell-off and eye-off look like three ideas.
- Its knockout is the same path drawn first in black, at the stroke plus twice the ring (3.5 for a 1.5 stroke and a ring of 1). The audit reads that pair as a knockout, not as a cut of the wrong width.
- What the knockout cuts loose is removed. When the slash leaves an end of the base smaller than the stroke on the far side, cover it with a black shape, or shorten the base's part in the base icon itself so both icons agree. Why: the crumb is a speck beside the slash at 16 px. The audit flags it (`speck`).
- The base must still be named by what is left on both sides of the slash. If it isn't, the base is too thin for a slash; show the off state on the control instead.

## Check

After drawing, the audit should print `FilePlus is File with a layer` with most of the outline in place, no `ring`, `gap`, `glyph` or `speck` flag, and on the sheet the ring should be open in the 1x pixel view.
