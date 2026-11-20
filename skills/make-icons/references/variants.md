# Outline, filled and duotone from the same parts

Read this before drawing a second variant of an icon: an outline next to a filled one, or a duotone.

## Parts

Split each icon into a base (the body: the page, the folder, the bell) and a layer (the detail: the text lines, the arrow, the clapper), and keep both as constants:

```tsx
const mailBase = <rect x="2.75" y="3.75" width="10.5" height="8.5" rx="1" />;
const mailFlap = "M4.5 6.25 8 8.75l3.5-2.5";
```

- Outline: base and layer are both stroked at the set's stroke, no fill.
- Filled: the base is filled and stroked with the same stroke, the layer is cut out of it at the cut width.
- Duotone: the base is filled at a third of the opacity, the layer is drawn on top at full strength.

Why: when the shape of the envelope changes, it changes once and every variant follows. Variants drawn one by one drift apart.

## Rules

- Every variant has the same outer box. Fill and stroke the filled base with the outline's stroke width, so its edge is the outline's outer edge. Why: when a tab swaps the outline for the filled icon on selection, a different box makes the icon jump. The audit flags variants whose boxes differ by more than a quarter unit (`variant`).
- Name them as the icon plus the variant: MailOutline, MailFill, MailDuo. Why: the audit pairs them by name.
- Details step down in the filled variant: what is a 1.5 stroke in the outline is a 1.25 cut in the filled one. Why: a cut is seen against the mass around it and reads wider than a line of the same width on its own.
- Icons that are only lines step up in a filled set. A plus, a check, an arrow has no body to fill, so beside filled icons it is drawn at the `line` stroke of the spec (1.75 where the set's stroke is 1.5). Why: at the same stroke it carries a fraction of their ink and reads as a lighter set.
- Duotone uses one colour. The base takes `opacity` on currentColor, not a second colour; add class hooks for two colours only when the project asks for them. Why: the icon keeps following text colour, hover and dark mode.
- In a duotone the layer never sits on the edge of the base at the same place as the base's own stroke. Keep it inside by a cut width, or let it cross the edge fully. Why: two edges a hair apart, one at a third of the strength, read as a blurred edge.
- Export each variant as its own flat icon. No `variant` prop that assembles layers when the page renders. Why: the composer and every layer ship to every page that uses one icon, and a drawing that only exists once assembled can't be audited.
- A selected state uses the filled variant only when the set has both for every icon in that control. Otherwise state shows on the control. Why: one tab with a filled twin and four without is worse than none.

## Check

Audit all variants together. Expect no `variant` flag, and on the sheet compare each pair at 1x: same size, same position, the filled one heavier and nothing else different.
