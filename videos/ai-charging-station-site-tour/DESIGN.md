# Design System

## Overview

AI充电站 is a calm, editorial dashboard for a creator-first AI daily digest. The interface uses a fixed left rail for date, stats, notes, source health, and theme controls, while the main canvas presents animated news cards in stacked sections. The visual identity balances paper-like daylight surfaces with a dark cinematic reading mode. Motion is smooth and useful: cards enter with spring movement, progress is shown as a thin gradient rail, and source status/feedback controls feel like lightweight instrumentation.

## Colors

- **Light Surface**: `#F3F3F0` — warm off-white page and sidebar base.
- **Dark Surface**: `#0A0A0B` — near-black night mode background.
- **Primary Text Light**: `#0F172A` — slate body and title text on light mode.
- **Primary Text Dark**: `#F1F5F9` — high-contrast text on dark mode.
- **Accent Sky**: `#38BDF8` — product accent and interactive highlight.
- **Accent Violet**: `#8B5CF6` — creator update rail and progress gradient.
- **Accent Fuchsia**: `#EC4899` — progress gradient and dark-mode energy.
- **Accent Emerald**: `#10B981` — source health OK ring/status.
- **Accent Amber**: `#F59E0B` — AI HOT and theme warmth.

## Typography

- **Sans**: Inter / system UI. Used for dashboard labels, metrics, source names, and compact controls.
- **Display**: Outfit / system UI. Used sparingly for large numeric moments and feature callouts.
- **Serif**: Playfair Display / Noto Serif SC / Georgia. Used for article titles and the "AI Daily." brand headline.
- **Monospace**: system mono. Used for dates, JSON/Markdown references, and health readouts.

## Elevation

The site avoids heavy shadows in favor of translucent panels, subtle borders, and blur. Cards use a soft hover lift with 3D tilt, thin left accent rails, and low-opacity gradients. The background uses large blurred atmospheric color fields plus a fine noise overlay, giving both light and dark modes a tactile, cinematic layer.

## Components

- **Fixed Digest Rail**: Sticky left sidebar with date picker, stats ring, editor note, source health, and theme switch.
- **Animated News Cards**: Large editorial cards with source metadata, category tags, hover lift, and optional feedback controls.
- **Source Health Meter**: Compact 8/8 OK style status with emerald ring and grouped source rows.
- **Theme Toggle**: Sliding pill control with sun/moon states and a half-second color transition.
- **Section Headers**: Small uppercase labels with vertical accent bars for 创作者更新, 官方动态, and AI HOT 精选.
- **AI HOT Feedback Controls**: Rounded floating thumbs-up/down controls that personalize future selection.
- **Gradient Scroll Progress**: Thin top progress rail using indigo, violet, fuchsia, and pink.

## Do's and Don'ts

### Do's

- Use warm off-white and near-black as the two main worlds.
- Keep cards editorial and readable; large serif headlines should breathe.
- Use motion to demonstrate workflow: dates slide, cards cascade, health rings draw, feedback pulses.
- Use source-health numbers and real digest counts as proof points.
- Let day/night mode transform the whole frame, not just a small toggle.

### Don'ts

- Do not make the video look like a generic SaaS landing page.
- Do not use loud full-screen gradients; keep gradients as atmosphere, rails, and highlights.
- Do not overcrowd article summaries; show enough to prove this is real content.
- Do not turn the creator-first product into a generic AI news feed.
- Do not rely on static screenshots alone; the site is valuable because it moves and filters.
