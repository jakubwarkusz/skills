<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.png">
  <img alt="Skills: instructions an AI agent loads when it works on an interface, so it checks what I would check." src=".github/assets/banner-light.png">
</picture>

<br>

Skills are instructions an AI agent loads when the task calls for them. These are the ones I use on interfaces: each one is a set of rules taken from fixes on real products, and each rule says why it exists, so the agent knows when to apply it and when to leave a deliberate choice alone.

## Install

```sh
npx skills add jakubwarkusz/skills
```

This lists every skill in the repository and installs the ones you pick, for Claude Code, Cursor, Codex and the other agents the [skills CLI](https://github.com/vercel-labs/skills) supports. To install one directly:

```sh
npx skills add jakubwarkusz/skills --skill interface-details
```

## Skills

| Skill | What it does |
| --- | --- |
| [interface-details](skills/interface-details/SKILL.md) | Reviews interface code and screens for the details people notice: depth and corners, every state of a control, motion in and out, copy and icons, and how it holds up on a phone. |
| [make-icons](skills/make-icons/SKILL.md) | Draws interface icons that belong to the set a project already has, or to a style agreed first when it has none. It draws a few at a time and measures every one. |

Each skill has its own page with every rule and an example at [wrksz.dev/skills](https://wrksz.dev/skills).

## Interface details

27 rules in six parts. The project's design system, brand and voice always come first; the rules fill the gaps and point out what is inconsistent.

| Part | Covers |
| --- | --- |
| Depth and shape | One recipe for depth, concentric corners, fields that don't look pressable, 40 px hit areas |
| States | Selection that doesn't change size, idle, working, done and failed, errors that say what to fix, undo over dialogs |
| Motion | CSS first, right from the first frame, quieter exits, one highlight under a list, themes that change at once |
| Text and icons | Drawn icons, decoration with a job, plain punctuation, concrete copy, streaming text left alone |
| Phones | `min-width: 0`, safe areas, sheets that follow the visual viewport, menus that don't rubber-band |
| Code | Ref callbacks over effects, no narrating comments, Tailwind rules only when the project uses it |

Ask for it by name or let the agent pick it up:

```text
Review the command menu in components/command-menu.tsx.
```

It answers with a short list of fixes, each with the file and line, what a person sees, and the change.

## Make icons

Six steps, from reading the icons a project already has to a sheet of the new ones. The agent draws three anchor icons first, then at most five at a time, and audits every batch before the next.

| Step | Covers |
| --- | --- |
| Find the style | The grid, stroke, caps and cut-outs of the icons already there, read from the code; duplicates and strays reported, not deleted |
| Ask first | With no set to follow: line or filled, the grid, the corners, two or three references, then three icons to approve |
| Write the spec | Three to six lines and an `icons.audit.json`, so every icon is held to the same numbers |
| Small batches | Three anchors, then five at a time, one icon at a time inside a batch |
| Draw | Size by optical weight, one stroke, cut-outs that survive 16 px, glyphs reused from the set, badges with an even ring, a drawing per size |
| Check | An audit of every batch and two sheets to look at: each icon on its grid and as 1x pixels, and the set in a toolbar beside labels |

The audit is a script that ships with the skill. It renders the icons in a browser and flags what the numbers can show: a stroke or cut that isn't the set's, an icon off centre, a gap that closes at 16 px, an uneven ring round a badge, a loose crumb of ink, a glyph that was redrawn instead of reused. What it can't measure, the agent checks on the sheets.

```text
Add a bell and a muted bell to components/icons.tsx.
```

It answers with the icons, the spec it followed, the audit result and the sheets.

The scripts need Node 22.15 or newer. The audit needs Playwright with Chromium; when it is missing the script says how to install it, and the skill tells the agent to ask before adding it to your project. React icons are rendered straight from their `.tsx` file. Icons from any other source are audited as a folder of `.svg` files.

Three reference files are read only when a step needs them: badges, slashes and dots, a drawing per size, and outline, filled and duotone versions.

## How the skills are written

- **One rule, one reason.** Every rule ends with *Why*, so the agent can tell a mistake from a decision.
- **Numbers where they were measured**, principles where a number would only fit one design.
- **Nothing for decoration.** A skill is read into the agent's context every time it runs. Detail that is only needed sometimes lives in reference files the skill points to.

## Layout

```text
skills/
  interface-details/
    SKILL.md
  make-icons/
    SKILL.md
    references/
    scripts/
```

One folder per skill, named after it, with a `SKILL.md` that holds the name and description in its frontmatter. A skill can bring reference files and scripts in its folder. The CLI finds anything under `skills/`.

## License

[MIT](LICENSE)
