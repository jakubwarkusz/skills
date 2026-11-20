# A drawing per size

Read this when an icon is shown outside the range its grid serves: a 16 grid drawing below 14 px or above 20 px.

## Why a second drawing

Scaling a drawing scales its stroke with it. A 16 grid icon with a 1.5 stroke, measured in this skill's test set:

| Shown at | Stroke on screen | What happens |
| --- | --- | --- |
| 12 px | 1.1 px | 1.25 cuts are 0.9 px and smudge shut on a 1x screen: a globe's lines, a bin's ribs, the knobs of sliders |
| 14 to 20 px | 1.3 to 1.9 px | holds |
| 24 px | 2.25 px | reads bold beside 14 to 16 px text, and looks empty: there is room for detail it doesn't have |

So an icon used at 12 or 24 px is drawn again for that size, on that grid. Only the icons that are used there: don't draw three sizes of a whole set on speculation.

## The numbers

| Grid | Live area | Stroke | Cut and smallest gap | Ring round a badge | Corner of a 16 grid radius 1.5 |
| --- | --- | --- | --- | --- | --- |
| 12 | 10 (margin 1) | 1 | 1 | 1 | 1 |
| 16 | 13 (margin 1.5) | 1.5 | 1.25 | 1 | 1.5 |
| 24 | 20 (margin 2) | 2 | 1.5 | 2 | 2 |

These are the set's numbers when it follows the common 1.5 at 16. A set with another stroke keeps its own at 16 and steps the others by the same amounts. A set with several corner radii steps each by the ratio of the grids and puts it on the nearest quarter unit. Write one spec entry per grid, so the audit measures each grid against its own numbers:

```json
{ "spec": { "12": { "stroke": 1, "cut": 1, "gap": 1 }, "16": { "stroke": 1.5, "cut": 1.25, "gap": 1 }, "24": { "stroke": 2, "cut": 1.5, "gap": 1.5 } } }
```

- The stroke is chosen per grid, not scaled. Why: 1.5 scaled to 12 is 1.125 and to 24 is 2.25; neither lands on the pixel grid, and both miss the weight of the text at that size.
- At 12 the stroke is 1 and sits on half units (a line at 2.5 covers the pixel from 2 to 3); at 24 the stroke is 2 and sits on whole units. Why: a one pixel line between two pixels is a two pixel grey line.

## What changes between sizes

- The small drawing drops detail. At 12 keep the outline and at most one detail, a detail being one cut or one part apart from the outline: a lock has no keyhole, a file no text lines, a globe one meridian or none. Why: at 12 px there are about ten pixels of live area; an outline and one cut use them up.
- The large drawing adds what the idea has room for, one or two things: the keyhole, a second text line, the fold of a page. Not decoration, and nothing thinner than that grid's cut. Why: a 16 grid drawing blown up to 24 has large empty areas that make it look unfinished.
- It is the same object at every size: the same outline, the same proportions, the same character of corner. Each drawing fills about the same share of its grid, its box divided by the grid; the share can't be identical, since the live areas are 10 of 12, 13 of 16 and 20 of 24. Why: the 12 px lock in a table and the 24 px lock in an empty state must read as one icon. The audit flags per-size drawings whose shares differ by more than a tenth, or whose width to height differs by more than 0.12 (`scale`).
- Start each size from the keylines of its grid, not from the other drawing's path scaled. Scale the proportions, then put every point back on that grid's quarter units and every outer edge on a whole unit. Why: a scaled path lands on fractions like 9.375, and its edges blur.

## Code

```tsx
export function Lock12Icon(props: IconProps) { /* viewBox 0 0 12 12, stroke 1 */ }
export function Lock16Icon(props: IconProps) { /* viewBox 0 0 16 16, stroke 1.5 */ }
export function Lock24Icon(props: IconProps) { /* viewBox 0 0 24 24, stroke 2 */ }
```

- Name each drawing with its grid, or give one component a `size` prop that picks between whole drawings (it returns one of three static svgs, it doesn't build one from parts); follow what the project does. The size suffix is how the audit knows the three belong together.
- Each drawing has its own `viewBox` and is shown only at its own size. Why: a 24 grid drawing shown at 16 px has a 1.33 px stroke and is the mistake this file exists to prevent.

## Check

Run the audit on all sizes together with the spec above. It prints one line of numbers per grid and measures each icon against its own grid. On the sheet, look at each drawing in the 1x pixel view at its own size: the 12 must be readable there, since that is all a 1x screen shows of it.
