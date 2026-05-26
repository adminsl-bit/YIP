# Design System Strategy: The Civic Canvas

## 1. Overview & Creative North Star
This design system is built upon the Creative North Star of **"The Digital Diplomat."** It is a visual philosophy that balances the solemnity of a parliamentary forum with the vibrant energy of India’s youth. We are moving away from the rigid, "boxed-in" layout of traditional educational portals in favor of an editorial, layered experience that feels alive.

The system breaks the standard template through **intentional asymmetry** and **tonal depth**. By utilizing overlapping elements—such as 3D mascots breaking the container bounds and headlines that bridge two different background sections—we create a sense of forward motion and active participation.

## 2. Colors & Surface Philosophy
The palette reimagines the Indian tricolor as a sophisticated, modern spectrum. Saffron becomes a sunset orange, White moves into a crisp porcelain, and Green evolves into a deep, scholarly emerald.

### Surface Hierarchy & Nesting
To achieve a premium feel, we prohibit the use of 1px solid borders for sectioning. Boundaries are defined solely through background shifts and **Tonal Layering**.
*   **The "No-Line" Rule:** Sectioning must be achieved by placing a `surface-container-low` section against a `surface` background. 
*   **Nesting Depth:** Treat the UI as a series of physical layers. Use `surface-container-lowest` for cards to make them "pop" against a `surface-container` background.
*   **Signature Textures:** Main CTAs and Hero backgrounds should utilize subtle linear gradients (e.g., `primary` to `primary-container`) to provide a "soul" and depth that flat hex codes cannot provide.

### Glassmorphism
Floating elements, such as navigation bars or active badges, must use a **Glassmorphism** effect. 
*   **Token:** `surface` at 70% opacity + 12px Backdrop Blur. 
*   This ensures the "Civic Canvas" background gradients bleed through, integrating the UI rather than pasting it on top.

## 3. Typography
The typography is a dialogue between authority and approachability.

*   **Display & Headlines (Plus Jakarta Sans):** These are our "Statement" tokens. Bold and sturdy, yet with modern geometric curves that feel youthful. Use `display-lg` for hero statements with tight letter-spacing (-0.02em) to create a high-end editorial look.
*   **Body & Labels (Manrope):** A highly legible, modern sans-serif. Manrope’s open counters ensure that long-form parliamentary resolutions or educational content remain accessible to a K-12 audience.
*   **Scale Usage:** Always maintain a high contrast between headings and body. If using `headline-lg`, pair it with `body-md` to emphasize the hierarchy of the "Statement."

## 4. Elevation & Depth
In this system, light and shadow are used to mimic a physical environment.

*   **The Layering Principle:** Depth is achieved by stacking. A `surface-container-lowest` card sitting on a `surface-container-low` background creates a soft, natural lift.
*   **Ambient Shadows:** For floating components, use extra-diffused shadows. 
    *   *Spec:* Blur: 32px | Opacity: 6% | Color: `primary` (tinted) rather than grey.
*   **The "Ghost Border" Fallback:** If a container requires more definition for accessibility, use the `outline-variant` token at **15% opacity**. Never use 100% opaque borders.
*   **Mascot Integration:** 3D assets (like the Tiger) should cast a soft, blurred shadow on the layers beneath them, grounding them in the "physical" space of the UI.

## 5. Components

### Buttons
*   **Primary:** High-gloss gradients using `primary` to `primary-container`. Corner radius: `full`.
*   **Secondary:** Glassmorphic background (semi-transparent `surface`) with a `primary` text.
*   **Interactive State:** On hover, buttons should scale slightly (1.02x) and increase shadow diffusion.

### Cards
*   **Styling:** No borders. Use `surface-container-lowest` for the card body. 
*   **Spacing:** Use "Breathable" padding (min 32px) to separate content.
*   **Imagery:** Photos or illustrations inside cards should have a `md` (0.75rem) roundedness to contrast with the `xl` (1.5rem) roundedness of the card itself.

### Chips & Badges
*   **The Grand Assembly Badge:** Use a `tertiary-fixed` background with `on-tertiary-fixed` text. The small green indicator dot should have a "pulse" animation to signify live status.

### Input Fields
*   **Surface:** Use `surface-container-high` for the input track.
*   **Active State:** Transition the background to `surface-lowest` and add a `primary` "Ghost Border" at 20% opacity.

### Navigation (The Floating Bar)
*   Forbid full-width header backgrounds. Use a centered, floating navigation capsule with `full` roundedness and a Glassmorphic blur to maintain the "Civic Canvas" aesthetic.

## 6. Do's and Don'ts

### Do
*   **Do** allow 3D mascots and illustrations to "break" their containers, overlapping into headers or neighboring sections.
*   **Do** use asymmetrical layouts. For example, a 60/40 split for text and imagery in hero sections.
*   **Do** use the Spacing Scale to create generous vertical white space (80px–120px) between major thematic sections.

### Don't
*   **Don't** use black (#000000) for text. Always use `on-surface` or `on-background` for a softer, premium feel.
*   **Don't** use standard 1px borders or dividers. If a visual break is needed, use a 1px tall `surface-variant` line at 30% opacity or simply a background color shift.
*   **Don't** clutter backgrounds. Patterns should be geometric, low-contrast, and strictly limited to `surface-container` transitions.

## 7. Student Dashboard — Implemented Layout

> This section documents what is actually built for the student-facing portal (`/student`). It supersedes general navigation guidance in Section 5 for this specific route.

### Shell Layout
The student dashboard uses a **fixed left sidebar + scrollable main content** pattern, not the floating capsule nav described in Section 5. The floating nav applies to public/marketing pages only.

| Zone | Implementation |
|---|---|
| Sidebar | `w-64` fixed left, white, `border-r border-outline-variant`, `py-6 px-4` |
| Content | `ml-64 p-8` on desktop, fills the remaining viewport |
| Mobile | Floating bottom bar replaces sidebar (`h-16`, `border-t`, same icon set) |
| App background | `bg-[#F3F4F6]` (`surface_container_low`) |

### Sidebar Header
- Logo text: `"The Civic Canvas"` in `font-headline font-bold text-on-surface text-lg`
- Sub-label: `"Digital Diplomat Portal"` in `font-body text-on-surface-variant text-xs font-medium`

### Sidebar Navigation
Six nav items with icon + label. Active state: `text-primary font-bold border-r-4 border-primary bg-primary/5`. Inactive: `text-on-surface-variant hover:bg-surface-container`.

| Tab ID | Label | Component |
|---|---|---|
| `profile` | Profile | Inline render in `StudentDashboard.tsx` |
| `civic-wall` | Civic Wall | `CivicWall.tsx` |
| `tree` | Tree | `ParliamentTree.tsx` |
| `ballot` | Ballot | `PollVoting.tsx` |
| `question-hour` | Question Hour | `QuestionHourHub.tsx` |
| `messages` | Civic Chat | `GlobalSquare.tsx` |

### Page Heading Pattern (all tabs except Profile)
A consistent two-part heading used across every tab:

```tsx
<h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
  Word <span className="text-secondary">Word</span>
</h1>
<p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
  <Icon className="w-3 h-3" />
  Subtitle Text
</p>
```

| Tab | Heading | Subtitle |
|---|---|---|
| Civic Wall | `Civic` **Wall** | National Legislative Discourse |
| Assembly Floor | `The Assembly` **Floor** | Representatives of the Sovereign Will |
| Ballot | `Parliamentary` **Ballot Chamber** | Active Legislative Floor |
| Question Hour | `Legislative` **Question Hour** | Parliamentary Deliberation Protocol |
| Civic Chat | `Civic` **Chat Hub** | Delegate Communications Network |

Primary word(s) in `text-primary`, final word(s) in `text-secondary` (saffron orange).

### Tab — Profile
Full delegate identity card. Sections: avatar + name + party badge, stats row (party number, serial, status), manifesto editor (inline `<textarea>`, save button), legislation list. Uses `bg-white rounded-3xl shadow-sm` card containers.

### Tab — Civic Wall (`CivicWall.tsx`)
Social post feed. Masonry-style cards with `rounded-3xl shadow-sm border-outline-variant/10`. Posts show avatar, name, party badge, timestamp, content, like/comment counts. Real-time via Supabase `postgres_changes` on `civic_posts`.

### Tab — Assembly Floor (`ParliamentTree.tsx`)
Visual parliament seating chart. Party blocks rendered as coloured seat grids. Filtered by party affiliation. No data writes — read-only from `profiles`.

### Tab — Ballot (`PollVoting.tsx`)
Active polls list. Each poll card: question text, Yes/No voting buttons with `border border-outline-variant`, Cast Vote CTA with blue gradient. Votes written to `poll_votes`. Real-time results bar updates via subscription.

### Tab — Question Hour (`QuestionHourHub.tsx`)
Two-column layout (`lg:grid-cols-12`): left `lg:col-span-3` form sidebar for submitting questions (ministry select + textarea + submit), right `lg:col-span-9` bento-grid feed of questions. Featured question spans `md:col-span-2`. Filter chips: All / Trending / Recent. Status badges: PENDING (grey), addressed (green), rejected (red). Data from `questions` table.

### Tab — Civic Chat (`GlobalSquare.tsx`)
Three-channel live chat: **Global Square** (all delegates), **Party Wing** (per-party), **Organizer Hub** (staff). Full-height container (`calc(100vh - 11rem)`). Messages delivered via **Supabase Realtime Broadcast** (not database writes — bypasses PostgREST RLS). Right sidebar shows active delegates split into Leadership and Candidates. Message delete via broadcast `del` event.

### Ghost Border Usage
Cards use `border border-outline-variant/10` — compliant with the Section 4 "Ghost Border Fallback" rule (≤15% opacity). Full 1px opaque borders are never used.

---

## 8. Color Tokens (Hex References)
When implementing "The Civic Canvas", map these specific tokens to your CSS variables or Tailwind configuration:

**Surfaces & Backgrounds**
*   `background`: `#f7f9fb`
*   `surface`: `#f7f9fb`
*   `surface_bright`: `#f7f9fb`
*   `surface_container_lowest`: `#ffffff`
*   `surface_container_low`: `#f2f4f6`
*   `surface_container`: `#eceef0`
*   `surface_container_high`: `#e6e8ea`
*   `surface_container_highest`: `#e0e3e5`
*   `surface_dim`: `#d8dadc`
*   `surface_variant`: `#e0e3e5`
*   `surface_tint`: `#4355b9`

**Primary (Blues)**
*   `primary`: `#13298f`
*   `on_primary`: `#ffffff`
*   `primary_container`: `#3042a6`
*   `on_primary_container`: `#afb9ff`

**Secondary (Oranges / Saffron)**
*   `secondary`: `#ac3509`
*   `on_secondary`: `#ffffff`
*   `secondary_container`: `#fe6f42`
*   `on_secondary_container`: `#631800`

**Tertiary (Greens / Emerald)**
*   `tertiary`: `#003e29`
*   `on_tertiary`: `#ffffff`
*   `tertiary_container`: `#00583b`
*   `on_tertiary_container`: `#42d59a`

**Text & Outlines**
*   `on_background`: `#191c1e`
*   `on_surface`: `#191c1e`
*   `on_surface_variant`: `#454653`
*   `outline`: `#757684`
*   `outline_variant`: `#c5c5d5`
