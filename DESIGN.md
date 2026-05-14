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

## 7. Color Tokens (Hex References)
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
