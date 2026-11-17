---
name: interface-details
description: "Reviews interface code and screens for the details people notice: depth and corners, every state of a control, motion in and out, copy and icons, and how it holds up on a phone. Use when building or reviewing UI components, before shipping a screen, or when something feels off."
---

# Interface details

Read the interface the way someone will use it: on a phone, in a hurry, pressing things twice. Look at what is on the screen, not at the design file. The project's design system, brand and voice come first: these rules fill the gaps and flag what is inconsistent, they don't override deliberate choices. Every finding names the file and line, says what a person sees, and gives the fix.

## Depth and shape
- One recipe for depth. Raised controls get their depth from one recipe the design system defines, usually a lighter top edge and a crisp 1 px edge. Use the project's own colours; if it has no recipe yet, propose one and apply it everywhere. Why: Stacked, blurry drop shadows smear on light grounds and disappear on dark ones. One recipe applied everywhere is what makes a set of controls feel like a family.
- Concentric corners. An inner element's radius is the outer radius minus the padding between them. Why: Equal radii on nested shapes make the gap look thicker at the corners than along the sides, which reads as careless even when nobody can say why.
- Fields don't look pressable. Text fields read as places to type: flatter than buttons, with a clear edge and a visible focus state. Avoid inset shadows unless the design system uses them. Why: When a field looks like a button, people tap it expecting an action, and an inset shadow next to raised buttons tends to look like dirt.
- Hit areas of 40 px. Anything tappable has at least 40 by 40 px of target, even when the visible icon is 16 px. Why: Thumbs miss small targets, and a missed tap feels like the product didn't respond.

## States
- Selection doesn't change size. Active, selected and current items change colour, background or a marker, not font weight or padding. Why: Bold text is wider. Changing weight or padding on select makes the row and its neighbours jump.
- Every action has four states. Idle, working, done and failed are each visible. A working button keeps its width and swaps its label for a spinner. Why: Within about 100 ms people need a sign their press landed. A button that changes width moves the layout under their finger.
- Errors say what to fix. Lead with the fix, keep the cause short, and put the message next to the field it is about. Why: An error is the one sentence people read twice. "Invalid input" makes them guess; "Two digits are missing" doesn't.
- Undo or hold, dialogs last. Destructive actions can be undone or are held to confirm. A confirmation dialog is the last resort. Why: People learn to click through dialogs without reading. Undo protects them without slowing anyone down.

## Motion
- CSS first. Start with CSS transitions and keyframes. Use an animation library only when the feel is clearly better, like a spring that follows scroll. Why: CSS transitions are interruptible and run off the main thread. A library is worth its weight only for what CSS can't do well.
- Right from the first frame. Set positions correctly in every state. Don't animate a correction of something that started in the wrong place. Why: A slide that fixes a wrong position looks like a glitch, not motion.
- Exits are quieter than enters. Exits are shorter and smaller. Something the person dismissed can simply go; something that leaves on its own, like a toast or a sheet, needs an exit. Why: Without an exit the screen jumps when an element vanishes, and people lose track of what changed.
- One highlight under the list. A highlight that moves between rows is a single element rendered under all of them, positioned to the active row. Why: A highlight inside each row paints over the row it is leaving while it travels, hiding its icon and text.
- Animate changes, not renders. Layout animations run when items are added or removed, not on every render. Why: Otherwise streaming text or a growing list drags everything above it along on every update.
- Themes change all at once. When the theme switches, every colour changes together, instantly unless the design animates the change on purpose. Under reduced motion, keep the state change and drop the travel. Why: When only some colours transition, the screen flashes a mix of both themes for a moment.

## Text and icons
- Icons are drawn. Use drawn icons, never typed symbols like arrows or a return sign for keys. Why: Typed symbols take the font's weight and baseline, so they never line up with real icons.
- Decoration has to mean something. Wide-tracked capitals, monospace and numbers like 01 / 02 / 03 are fine when the design system gives them a role. Flag them where they are only there to look designed. Why: Ornament without a job adds noise and tells the reader nothing about what the thing is.
- Plain punctuation. Interface copy follows the project's voice guide. Where it says nothing, prefer commas and full stops to em dashes and double hyphens. Why: Long dashes break short interface lines awkwardly and are a common tell of generated text.
- Name the real thing. Copy names what the person gets. If the same vague word appears three times, nothing was decided. Why: Concrete nouns are faster to read and harder to misunderstand.
- Leave streaming text alone. Don't balance or prettify lines of text that is still arriving. Why: Balanced wrapping recalculates on every word, so finished lines keep jumping.

## Phones
- min-width: 0 on flex and grid children. Children that hold text, code or images get min-width: 0. Why: Their default minimum is their content. One long line or code block pushes the whole page sideways.
- Pad by the safe areas. With viewport-fit=cover, bars pad by env(safe-area-inset-top) and the bottom inset. Why: Safari draws the page under the status bar and the home indicator. A blur doesn't reach there; padding does.
- Sheets follow the visual viewport. Full-screen sheets with fields size and position themselves to the visual viewport. Why: iOS doesn't shrink the layout when the keyboard opens, so the main button ends up behind it.
- Menus don't rubber-band. Full-screen menus scroll only when their content is taller than the screen. Why: Otherwise a drag on iOS pulls the whole menu, header and close button included.
- Truncate long values, copy them whole. Commands, URLs and hashes truncate in one line, and their copy button copies the full value. Why: Wrapped commands are hard to read and easy to paste half of.

## Code
- Ref callbacks over effects. In React projects, attach listeners, observers and measurements in ref callbacks with cleanup. Why: They run when the element exists and clean up when it goes, without effect timing bugs.
- No narrating comments. Don't add comments that describe what the code plainly does. Why: They go stale and bury the few comments that explain something non-obvious.
- Tailwind, when the project uses it. Prefer canonical classes to arbitrary values, and give repeated one-off sizes a token. State styles that must win live in the same layer as the utilities. Why: Utilities override component CSS, so a hover or error style written in a lower layer silently loses.
