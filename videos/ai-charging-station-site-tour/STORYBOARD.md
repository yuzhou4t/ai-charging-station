# Storyboard

**Format:** 1920x1080
**Audio:** No voiceover in v1. Optional soft electronic underscore can be added later.
**VO direction:** On-screen captions only, calm but decisive.
**Style basis:** DESIGN.md, current AI充电站 React/Vite frontend.

## Asset Audit

| Asset | Type | Assign to Beat | Role |
| --- | --- | --- | --- |
| `data/digests/2026-06-10.json` | Data | All beats | Real item counts, source health, current cards |
| `web/src/assets/hero.png` | Image | Beat 1 | Small atmospheric brand visual, optional texture |
| Current frontend components | UI reference | All beats | Recreated sidebar, cards, source health, theme toggle |
| AI HOT feedback controls | UI feature | Beat 4 | Personalization proof |

## BEAT 1 - OPEN THE DAILY (0:00-0:05)

**Concept:** The viewer lands inside the AI充电站 dashboard in light mode. The page is alive: mesh blobs breathe, the progress rail draws, the left dashboard locks in, and today's numbers count up.

**Visual:** Warm off-white canvas, fixed left rail, "AI Daily." headline, date 2026-06-10, a 32-item metric and 8/8 source-health ring. Three cards float in from the right edge.

**Animation:** Progress rail draws left to right. Sidebar slides in. Stat numbers count up. Cards cascade upward with spring ease.

**Transition:** Velocity-matched zoom into the first creator card.

## BEAT 2 - CREATOR FIRST (0:05-0:11)

**Concept:** Creator updates are not buried under generic headlines. The卡兹克兜底 source rises into focus, proving that AI HOT can recover creator items when the direct route is weak.

**Visual:** A large creator card for Claude Fable 5 from X：卡兹克, a second WeChat card from 数字生命卡兹克, and source chips for B站 / WeChat / AI HOT. The section label "创作者更新" anchors the scene with a violet rail.

**Animation:** Cards tilt in 3D, source chips orbit gently, and the creator rail fills violet to fuchsia.

**Transition:** Card stack folds into a compact source-health table.

## BEAT 3 - SOURCE HEALTH (0:11-0:17)

**Concept:** The app is honest about ingestion. It shows what worked, what failed, and why, so the daily report never becomes a black box.

**Visual:** 8 source rows, emerald OK dots, grouped "数字生命卡兹克 + AI HOT兜底" row, and JSON/Markdown output labels.

**Animation:** Health ring draws to 100%. Rows appear one by one. JSON and Markdown file paths type on in monospace.

**Transition:** A thin gradient scanline sweeps into the AI HOT personalization scene.

## BEAT 4 - PERSONALIZED AI HOT (0:17-0:23)

**Concept:** The system learns taste slowly. The user can tell it which AI HOT items are good or noisy, and the next digest reflects that signal.

**Visual:** AI HOT card rail with floating thumbs-up and thumbs-down controls. A feedback signal line travels from the card into a small "feedback memory" panel.

**Animation:** Thumb buttons pulse, a green signal packet moves along a path, and lower-priority cards fade back.

**Transition:** Theme toggle expands into a whole-frame day-to-night wipe.

## BEAT 5 - DAY / NIGHT + HANDOFF (0:23-0:30)

**Concept:** The app becomes a daily ritual: light mode for scanning, dark mode for focused reading, and a desktop launcher that opens the archive immediately.

**Visual:** Split-screen day/night dashboard morphs to full dark mode. Final title: "AI充电站" with subline "creator-first AI daily digest". Footer shows `data/latest.json`, `YYYY-MM-DD.md`, and `AI充电站.command`.

**Animation:** Toggle knob slides. Background colors crossfade. Cards glow softly. Final title settles with a clean scale pulse.

**Transition:** End on held dark frame.

## Production Architecture

```text
videos/ai-charging-station-site-tour/
├── DESIGN.md
├── SCRIPT.md
├── STORYBOARD.md
├── index.html
├── package.json
└── renders/
```
