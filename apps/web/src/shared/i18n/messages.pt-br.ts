// Typed pt-BR message source (full i18n library is TD-001). Keys are the single source of UI copy.
//
// Split by top-level namespace into `./messages/*.pt-br.ts` (019/Polish — readability refactor,
// behavior identical): each file owns the keys of one or a few related top-level namespaces, and
// this module composes them back into the SAME `messages` object with the SAME top-level keys.
// No consumer imports change — the public path stays `@/shared/i18n/messages.pt-br` and the only
// export stays `messages`.
import {
    appName,
    theme,
    auth,
    signIn,
    account,
    privacy,
    nav,
    state,
    session,
    notFound,
    error,
    apiError,
    ds,
} from "./messages/common.pt-br";
import { calculator } from "./messages/calculator.pt-br";
import { catalog, catalogForm, productForm } from "./messages/catalog.pt-br";
import { bom } from "./messages/bom.pt-br";
import { history } from "./messages/history.pt-br";
import { quote } from "./messages/quote.pt-br";
import { scenarios } from "./messages/scenarios.pt-br";
import { billing, premiumTeaser } from "./messages/billing.pt-br";

export const messages = {
    appName,
    theme,
    auth,
    signIn,
    calculator,
    account,
    privacy,
    nav,
    catalog,
    catalogForm,
    productForm,
    bom,
    history,
    quote,
    scenarios,
    state,
    session,
    notFound,
    error,
    apiError,
    billing,
    premiumTeaser,
    ds,
} as const;
