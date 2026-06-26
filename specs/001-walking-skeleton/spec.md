# Feature Specification: Walking Skeleton — minimal authenticated price

**Feature Branch**: `001-walking-skeleton`

**Created**: 2026-06-26

**Status**: Draft

**Input**: User description: thin vertical slice — Google login + a minimal 3D-print material+markup price on one mobile-first screen, deployed on the web.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and reach the calculator (Priority: P1)

A 3D-printing seller opens Precifica3D, signs in with their Google account, and lands on the price
calculator screen. Without signing in, they cannot reach the calculator.

**Why this priority**: Proves the authentication boundary end-to-end. Without it there is no gated product
and no basis for paid access later. It is the riskiest integration in the slice.

**Independent Test**: Open the app while signed out → the calculator is not accessible and the user is
prompted to sign in. Complete Google sign-in → the calculator screen appears.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** they open the calculator URL, **Then** they are directed to sign in
   and the calculator is not shown.
2. **Given** a visitor on the sign-in screen, **When** they sign in with a valid Google account, **Then** they
   reach the calculator screen.
3. **Given** a signed-in user, **When** a protected request is made without valid authentication, **Then** the
   system rejects it (access is not granted by the client alone).

---

### User Story 2 - Compute a minimal price (Priority: P2)

On the calculator screen the user enters filament cost per roll, roll weight, grams used, and a markup
percentage, and immediately sees the material cost and the suggested price.

**Why this priority**: Delivers the first unit of real product value (a price) and proves the offline-capable
calculation core. Depends on US1 for access but is independently testable as a calculation.

**Independent Test**: With the inputs filled, verify the displayed material cost and suggested price match the
defined formula; disconnect the network and confirm the calculation still produces a result.

**Acceptance Scenarios**:

1. **Given** cost_per_roll = R$100, roll_weight = 1 kg, grams = 20, markup = 50%, **When** the user views the
   result, **Then** material cost = R$2.00 and suggested price = R$3.00.
2. **Given** any valid inputs, **When** the user changes a value, **Then** the results update accordingly.
3. **Given** no internet connection, **When** the user computes a price, **Then** a correct result is shown.

### Edge Cases

- **Roll weight = 0** → division by zero MUST be prevented; the user sees a friendly validation message.
- **Grams = 0 or markup = 0** → allowed; price equals material cost (markup 0) or zero (grams 0).
- **Negative inputs** → rejected with a validation message.
- **Offline at sign-in time** → signing in may be unavailable; the system communicates this clearly (the
  calculation itself remains available once authenticated).
- **Expired or invalid session** → the user is returned to sign in; protected server requests are rejected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let a user sign in using their Google account.
- **FR-002**: System MUST restrict the calculator to authenticated users and direct signed-out visitors to sign in.
- **FR-003**: System MUST enforce authentication for protected operations on the server side; the client alone
  MUST NOT be trusted to grant access. *(Constitution Principle IV)*
- **FR-004**: Users MUST be able to enter filament cost per roll (BRL), roll weight (kg), grams used, and a
  markup percentage.
- **FR-005**: System MUST compute material cost = cost_per_roll ÷ (roll_weight_kg × 1000) × grams.
- **FR-006**: System MUST compute suggested price = material cost × (1 + markup%). *(markup over cost)*
- **FR-007**: System MUST display material cost and suggested price formatted as Brazilian Reais (BRL).
- **FR-008**: The price calculation MUST work without an internet connection.
- **FR-009**: The interface MUST be mobile-first and usable on desktop; user-facing copy MUST be in Brazilian
  Portuguese (pt-BR).
- **FR-010**: The application MUST be deployed and reachable on the web.
- **FR-011**: System MUST validate inputs (non-negative; roll weight > 0) and show friendly error messages.

### Key Entities *(include if feature involves data)*

- **User**: an authenticated person, identified by their Google sign-in. Minimal attributes: stable user id and
  email. No additional profile data in this slice.
- **Price Calculation**: a transient computation. Inputs: cost_per_roll, roll_weight_kg, grams, markup_pct.
  Outputs: material_cost, suggested_price. Not persisted in this slice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can sign in with Google and reach the calculator in under 30 seconds.
- **SC-002**: For 100% of defined numeric test cases, the displayed material cost and suggested price match the
  specified formula.
- **SC-003**: The price calculation produces a correct result with no internet connection.
- **SC-004**: Unauthenticated access to the calculator is blocked 100% of the time, and a protected server
  request without valid authentication is rejected 100% of the time.
- **SC-005**: The deployed app renders without layout breakage on a typical mobile viewport (≤ 414 px wide).

## Out of Scope

- The full corrected pricing model: energy, machine/depreciation, failure rate, finishing, marketplace fees,
  multi-piece BOM, and multiple products/catalog (later increments).
- Subscriptions, payments, and premium gating logic.
- Android / Google Play packaging (web-first deploy only).
- Persisting calculations or any product/catalog data.

## Assumptions

- Google sign-in is the sole authentication method for this slice; email/password and other providers are out of scope.
- The minimal material+markup calculation is intentionally a thin slice to prove the vertical; the full pricing
  model is a separate, later increment (see `docs/pricing-model-from-spreadsheet.md`).
- No persistence is required; the calculator is stateless and identity comes from the sign-in provider.
- The pricing model is original, built from domain knowledge; the third-party reference spreadsheet is not copied.
