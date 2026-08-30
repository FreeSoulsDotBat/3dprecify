# Feature Specification: App shell & design system (4-tab product frame)

**Feature Branch**: `003-app-shell-and-ds`

**Created**: 2026-07-02

**Status**: Draft

**Input**: User description: "Refactor the existing 001 app (Google login + single material+markup
calculator) onto the homologated product design system and the 4-tab app shell, WITHOUT expanding functional
scope. Structural + visual refactor: still material+markup only, still everything free, still no persistence,
still offline-capable. Creates the shell that every later epoch (E1..E6) reuses."

> **Note on scope**: This is a **refactor slice**. It re-frames what `001` already delivers inside the
> product's real navigation and visual identity. It adds **no new user-facing calculation, no persistence, no
> premium/payment logic**. Its value is a coherent, accessible, on-brand frame that unblocks every later
> increment. The full pricing model (E1), catalog/save (E2), history (E4), marketplace (E5) and subscription
> (E6) are out of scope here (see Out of Scope).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate the product through a consistent 4-tab frame (Priority: P1)

A 3D-printing seller opens Precifica3D and sees a branded app with four clearly labelled sections —
**Calcular, Catálogo, Histórico, Conta**. On a phone the sections are a bottom tab bar; on a wider screen they
are a side navigation. Switching sections is immediate, the current section is clearly indicated, and the
calculator remains reachable and produces the same correct price it did before.

**Why this priority**: The 4-tab frame is the skeleton every later epoch plugs into. Without it there is no
place to put catalog, history, or account, and the product does not read as the homologated vision. It is the
core deliverable of this slice.

**Independent Test**: Open the app; confirm the four sections are present and reachable on both a narrow
(≤414 px) and a wide viewport; switch between them and confirm the active section is indicated and the
calculator still shows material R$ 2,00 / suggested price R$ 3,00 for the canonical inputs.

**Acceptance Scenarios**:

1. **Given** a visitor on a phone-sized screen, **When** the app loads, **Then** a bottom tab bar shows
   Calcular, Catálogo, Histórico and Conta, with the current section highlighted.
2. **Given** a visitor on a desktop-sized screen, **When** the app loads, **Then** the same four sections
   appear as a side navigation, with the current section highlighted.
3. **Given** the user is on any section, **When** they select another section, **Then** the new section is
   shown immediately and its title is presented at the top.
4. **Given** the calculator section, **When** the user enters cost/roll R$ 100, roll weight 1 kg, grams 20 and
   markup 50%, **Then** material cost = R$ 2,00 and suggested price = R$ 3,00.

---

### User Story 2 - The authentication boundary is preserved through the new frame (Priority: P1)

Calculating a price is free and available to anyone, including signed-out visitors and while offline. Saving-
oriented sections (Catálogo, Histórico, Conta) require signing in. A signed-out visitor who tries to reach
them is directed to sign in; the server continues to reject protected requests that lack valid authentication.

**Why this priority**: The auth boundary is the product's paid-access foundation and the riskiest integration.
It already works in `001`; this slice must not regress it while the navigation is rebuilt.

**Independent Test**: While signed out, use Calcular successfully (including offline); attempt Catálogo,
Histórico or Conta and confirm being sent to sign in; sign in and confirm those sections open; confirm a
protected server request without valid authentication is rejected.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** they open Calcular, **Then** the calculator is usable (online or
   offline) without signing in.
2. **Given** a signed-out visitor, **When** they select Catálogo, Histórico or Conta, **Then** they are
   directed to the sign-in screen.
3. **Given** a visitor on the sign-in screen, **When** they sign in with a valid Google account, **Then** they
   return to the section they intended to reach.
4. **Given** a signed-in user, **When** a protected request is made without valid authentication, **Then** the
   server rejects it (the client alone does not grant access).

---

### User Story 3 - A consistent, accessible, on-brand experience in light and dark (Priority: P2)

Every screen uses the homologated visual identity (logo, colours, typography, graphics) and reads correctly in
both dark (default) and light themes. Status messages are legible, interactive targets are comfortably
tappable, and keyboard/assistive-technology users can follow where focus goes.

**Why this priority**: Fidelity to the approved design and accessibility are acceptance conditions for the
product; getting them right in the shell means every later epoch inherits them.

**Independent Test**: On a ≤414 px screen and a desktop screen, in both themes, verify: no horizontal scroll;
status text meets contrast; touch targets are at least 44 px; the theme preference is respected on first
paint; and switching section moves keyboard focus to the new section's title.

**Acceptance Scenarios**:

1. **Given** any of the four sections at 390 px wide, **When** it renders, **Then** there is no horizontal
   scrolling.
2. **Given** the dark theme (default) and the light theme, **When** a status message (error/success/info) is
   shown, **Then** its text meets a contrast ratio of at least 4.5:1 against its background.
3. **Given** any interactive control (tab item, button, switch, edit affordance), **When** measured, **Then**
   its tappable area is at least 44 × 44 px.
4. **Given** a keyboard or screen-reader user, **When** they switch section, **Then** focus moves to the new
   section's title.
5. **Given** a first-time visitor whose device prefers a theme, **When** the app first paints, **Then** it
   applies the resolved theme (saved preference, else default) with no flash of the wrong theme.

---

### User Story 4 - Graceful system states with honest messaging (Priority: P2)

The app communicates clearly when things are not normal: an offline banner while disconnected, a friendly
"page not found" for unknown routes, and an on-brand generic error screen that shows a support code the user
can quote. All copy is in Brazilian Portuguese and makes no promises the product has not decided (no payment
provider name, no cancellation policy, no price).

**Why this priority**: These states are cross-cutting and reused everywhere; building them once in the shell
avoids duplicated, inconsistent handling later.

**Independent Test**: Disconnect the network and confirm the offline banner appears (and the calculator still
works); navigate to an unknown route and confirm a branded 404; trigger a generic error and confirm an
on-brand screen showing a support code; review all shell copy for honesty (no undecided commercial claims).

**Acceptance Scenarios**:

1. **Given** the device goes offline, **When** any section is shown, **Then** a status banner announces the
   offline state and the calculator keeps working.
2. **Given** an unknown or invalid route, **When** it is opened, **Then** a branded "página não encontrada"
   screen is shown with a way back to the app.
3. **Given** a generic application error, **When** it occurs, **Then** an on-brand error screen is shown with a
   reload action and a discreet line "Código de suporte: <identifier>".
4. **Given** any shell copy, **When** reviewed, **Then** it contains no payment-provider name, no cancellation
   policy and no price.

---

### User Story 5 - Account section reflects the server-confirmed identity (Priority: P3)

In Conta the user sees the identity confirmed by the server (name/email from the sign-in), a plan indicator, a
theme toggle, and a sign-out action. The account screen is a real screen (not a placeholder), but contains no
premium/upsell or billing logic in this slice.

**Why this priority**: Conta is one of the four tabs and must be real to demonstrate the shell end-to-end; the
server-confirmed identity establishes the "server is the source of truth" pattern the paid tiers will rely on.

**Independent Test**: Sign in and open Conta; confirm the displayed identity comes from the server (not a
hardcoded value); toggle the theme and confirm it changes and persists; sign out and confirm return to a
signed-out state.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open Conta, **Then** their identity as confirmed by the server is
   shown (not a placeholder name).
2. **Given** Conta, **When** the user toggles the theme, **Then** the theme changes immediately and is
   remembered on next open.
3. **Given** Conta, **When** the user signs out, **Then** they return to a signed-out state and the
   saving-oriented sections again require sign-in.

---

### Edge Cases

- **Signing in while offline**: sign-in requires a connection; the app communicates this clearly, and the
  calculator remains usable offline once the user is already authenticated (or as an anonymous visitor).
- **Expired or invalid session**: the user is returned to sign-in for the protected sections; protected server
  requests are rejected.
- **Deep-link to a protected section while signed out**: the user is sent to sign-in and, after signing in,
  lands on the originally requested section.
- **Direct load of Calcular while signed out and offline**: the calculator loads and computes from cache.
- **Reduced-motion preference**: decorative motion (splash, any shimmer) is suppressed.
- **Unknown route**: resolves to the 404 screen, not a blank frame.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST present four navigable sections — Calcular, Catálogo, Histórico, Conta — as a bottom
  tab bar on narrow screens and a side navigation on wide screens, with the active section clearly indicated.
- **FR-002**: The app MUST present the current section's title prominently, and MUST move keyboard/assistive
  focus to that title when the section changes.
- **FR-003**: Calcular MUST be usable without signing in and without a network connection, and MUST reproduce
  the `001` result (material cost and suggested price from cost/roll, roll weight, grams and markup).
- **FR-004**: Catálogo, Histórico and Conta MUST require authentication; a signed-out visitor selecting them
  MUST be directed to sign in and, after signing in, returned to the intended section.
- **FR-005**: The server MUST remain the authorization boundary; protected requests without valid
  authentication MUST be rejected (the client alone MUST NOT grant access).
- **FR-006**: The app MUST render the homologated visual identity (logo, brand colours, typography, brand
  graphics, iconography) across all shell screens.
- **FR-007**: The app MUST support a dark theme (default) and a light theme, resolve the theme before first
  paint (saved preference, else default) with no wrong-theme flash, and let the user toggle and persist it.
- **FR-008**: Status text (error/success/info) MUST meet a contrast ratio of at least 4.5:1 against its
  background in BOTH themes.
- **FR-009**: All interactive controls MUST have a tappable area of at least 44 × 44 px.
- **FR-010**: No shell screen MUST produce horizontal scrolling at 390 px width.
- **FR-011**: The app MUST show an offline banner while disconnected (announced to assistive technology) and
  keep the calculator working offline.
- **FR-012**: The app MUST show a branded "page not found" screen for unknown routes and an on-brand generic
  error screen that includes a reload action and a discreet support-code line "Código de suporte: <identifier>".
- **FR-013**: Conta MUST display the identity confirmed by the server (not a hardcoded value), a plan
  indicator, a theme toggle and a sign-out action.
- **FR-014**: All user-facing copy MUST be in Brazilian Portuguese and MUST NOT state undecided commercial
  facts (no payment-provider name, no cancellation policy, no price).
- **FR-015**: Catálogo and Histórico MUST render as neutral placeholder shells in this slice (no catalog CRUD,
  no saved history, no premium/upsell logic).
- **FR-016**: Modal/dialog surfaces introduced by the shell MUST trap focus while open, close on Escape, and
  return focus to the control that opened them.
- **FR-017**: Error messages surfaced from the server MUST be presented to the user as friendly
  Brazilian-Portuguese phrases mapped from the server's error codes (users never see raw technical detail).

### Key Entities *(include if feature involves data)*

- **User identity (read-only, from the server)**: the authenticated person's stable id and email as confirmed
  by the sign-in provider and returned by the server's "me" endpoint. No new data is persisted by this slice.
- **Theme preference (client-only)**: the user's dark/light choice, remembered on the device; not server data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The four sections are reachable and correctly indicated on both a ≤414 px viewport and a desktop
  viewport, 100% of the time.
- **SC-002**: For the canonical inputs (R$ 100 · 1 kg · 20 g · 50%), the calculator shows material R$ 2,00 and
  suggested price R$ 3,00, including with no network connection.
- **SC-003**: Unauthenticated access to Catálogo/Histórico/Conta is redirected to sign-in 100% of the time, and
  a protected server request without valid authentication is rejected 100% of the time.
- **SC-004**: No shell screen shows horizontal scrolling at 390 px width (0 px overflow on all four sections).
- **SC-005**: Status text meets ≥ 4.5:1 contrast in both themes, and every interactive control measures at
  least 44 × 44 px.
- **SC-006**: On section change, keyboard/assistive focus lands on the new section's title, verifiable with the
  keyboard alone.
- **SC-007**: The offline banner appears within 1 second of losing connectivity and the calculator continues to
  compute; the 404 and generic-error screens render with the support-code line present.
- **SC-008**: A visual homologation pass by `qa-produto` finds zero high-severity design-fidelity or
  accessibility defects on the shell, in both themes, at ≤414 px and desktop.

## Out of Scope

- The full corrected pricing model (energy, machine/depreciation, failure rate, wholesale, marketplace fees,
  varejo/atacado, progressive-disclosure sections, result skeletons) — that is E1.
- Catalog CRUD, add sheets, entities persistence, saved calculations, and the freemium/upsell/premium-gating
  logic — that is E2 (Catálogo/Histórico are placeholders here; the server "me" endpoint carries no
  entitlement field yet).
- History list/detail/compare/export — E4. Marketplace simulator — E5. Subscription/payments — E6.
- Public deployment (that is the pending `001` deploy task).

## Assumptions

- Builds directly on `002-foundation` (toolchain, gates, backend + web skeletons, contract pipeline, CI) and
  `001-walking-skeleton` (Google sign-in, the material+markup calculator, PWA offline), all green.
- The design-system approach is ratified in `docs/adr/0007-design-system-layer.md` (Radix behaviour skinned
  with the brand token CSS); this spec assumes that decision.
- Google sign-in remains the sole authentication method for this slice (unchanged from `001`); the launch set
  of providers is a separate product decision.
- The homologated prototype (approved by `qa-produto` over three rounds) is the visual source of truth for the
  shell, screens, states and copy.
- No new persisted data and no new server business logic are introduced; the server's "me" endpoint continues
  to return identity only.
- Brand fonts are self-hosted for offline capability; the display face substitution already accepted in the
  prototype remains until the licensed font is available.
