---
name: HiFix Prime
colors:
  surface: '#101415'
  surface-dim: '#101415'
  surface-bright: '#363a3b'
  surface-container-lowest: '#0b0f10'
  surface-container-low: '#191c1e'
  surface-container: '#1d2022'
  surface-container-high: '#272a2c'
  surface-container-highest: '#323537'
  on-surface: '#e0e3e5'
  on-surface-variant: '#c3c6d7'
  inverse-surface: '#e0e3e5'
  inverse-on-surface: '#2d3133'
  outline: '#8d90a0'
  outline-variant: '#434655'
  surface-tint: '#b4c5ff'
  primary: '#b4c5ff'
  on-primary: '#002a78'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#0053db'
  secondary: '#bec6e0'
  on-secondary: '#283044'
  secondary-container: '#3f465c'
  on-secondary-container: '#adb4ce'
  tertiary: '#7bd0ff'
  on-tertiary: '#00354a'
  tertiary-container: '#00759f'
  on-tertiary-container: '#e1f2ff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#7bd0ff'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#101415'
  on-background: '#e0e3e5'
  surface-variant: '#323537'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  title-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 4px
  container-padding: 24px
  stack-gap: 16px
  section-gap: 48px
  max-width: 1280px
---

## Brand & Style

The design system is engineered to evoke a sense of high-end technical precision and domestic reliability. It targets a premium demographic that values expertise, speed, and transparency in home maintenance. 

The aesthetic is **Precision Glassmorphism**—a hybrid of Apple’s depth-centric VisionOS and the high-performance utility of developer-centric tools like Linear. The UI must feel like a sophisticated instrument: weightless yet grounded, technical yet approachable. By utilizing translucent layers and vibrant blurs against a dark, cosmic backdrop, the interface recedes to let high-quality photography of craftsmanship take center stage.

- **Minimalism:** Aggressively reduced interface clutter; focus on singular actions.
- **Glassmorphism:** Heavy use of backdrop filters and edge-lighting to define hierarchy.
- **Corporate / Modern:** Systematic, high-density layouts that remain legible and professional.

## Colors

The palette is anchored in a "Deep Space" spectrum. The background is a near-black Midnight Blue to maximize the luminosity of the glass effects. 

- **Primary (Royal Blue):** Used for primary calls to action and active states. It represents trust and "The Pro."
- **Secondary (Deep Navy):** Utilized for structural containers and subtle depth layering.
- **Accent (Electric Cyan):** Reserved for technical highlights, status indicators, and subtle glow effects behind glass layers.
- **Surface:** Surfaces are rarely solid; they use a semi-transparent white (5-10% opacity) with a `blur(20px)` backdrop filter to create the signature glass look.

## Typography

This design system utilizes **Inter** for its neutral, highly legible character, paired with **Geist** for technical labels and data-heavy metadata. 

Headlines use tight letter-spacing to create a "locked-in" professional feel. Body text maintains generous line height for readability against dark backgrounds. Use the `label-sm` role specifically for service categories, technical specs, and status tags to inject a modern, "pro-tool" vibe.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a hard-stop at 1280px for desktop. 

- **Columns:** 12-column grid for desktop, 4-column for mobile.
- **Gutters:** 24px fixed gutters to allow glass containers enough breathing room to show their edge highlights.
- **Rhythm:** An 8px linear scale (4, 8, 16, 24, 32, 48, 64) drives all padding and margins. 
- **Mobile Reflow:** Elements primarily stack vertically in a single-column card format. Top-level navigation transitions from a header to a bottom-docked translucent tab bar on mobile.

## Elevation & Depth

Depth is the core differentiator of this design system. It is achieved through **Optical Stacked Layers** rather than traditional dropshadows.

1.  **Level 0 (Background):** Solid Midnight Blue (#020617).
2.  **Level 1 (Main Canvas):** Large cards with `background: rgba(255, 255, 255, 0.03)`, a 1px border at `rgba(255, 255, 255, 0.1)`, and `backdrop-filter: blur(12px)`.
3.  **Level 2 (Active Elements):** Modals and popovers use `rgba(255, 255, 255, 0.08)` with a 1px border at `rgba(255, 255, 255, 0.2)`.

**Shadows:** Use extremely soft, large-radius shadows (e.g., `0 20px 50px rgba(0, 0, 0, 0.5)`) to lift glass panels off the background. Always apply a subtle top-down inner light (1px white border at low opacity) to simulate light catching the "edge" of the glass.

## Shapes

The shape language is ultra-smooth and friendly yet precise. Following the "VisionOS" influence, the design system uses large, organic radii.

- **Primary Containers:** 32px border radius.
- **Secondary Elements (Inputs, Buttons):** 16px border radius or fully "pill" shaped.
- **Nested Elements:** Ensure "Inner Radius = Outer Radius - Padding" logic to maintain geometric harmony.

## Components

### Buttons
Primary buttons are solid Royal Blue with a subtle inner-glow at the top edge. Secondary buttons are "Glass Buttons"—translucent background with a 1px border. All buttons should have a hover state that increases the background opacity by 5% and expands the shadow slightly.

### Cards
Cards are the primary container. They must feature a `border-top: 1px solid rgba(255,255,255,0.15)` to catch simulated overhead lighting. Content within cards should have a padding of at least 24px.

### Inputs
Input fields are dark and recessed. Use `background: rgba(0, 0, 0, 0.2)` with a 1px border. On focus, the border transitions to Royal Blue and gains a subtle 4px outer glow of Electric Cyan.

### Chips & Tags
Used for service status (e.g., "In Progress," "Completed"). These use high-saturation backgrounds (using the Accent color) but at low opacity (15%) with solid text for a "neon-on-glass" effect.

### Service Tracker
A unique component for this design system: a vertical or horizontal "technical timeline" using monospaced fonts (Geist) and Electric Cyan glow points to show real-time technician progress.