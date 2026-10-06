# Code Guideline

## Project Structure Overview

```
project-root/
  ├── i18n.config.json       # i18n manifest for supported locales and language metadata
  ├── public/
  │   └── locales/           # public/locales/{code}.json translation files
  ├── supabase/
  │   ├── config.toml        # backend function JWT settings per function
  │   ├── migrations/        # applied schema migrations (generated, do not hand-edit)
  │   └── functions/         # server-side backend functions, one directory each
  ├── src/
  │   ├── components/        # All reusable UI components
  │   │   ├── kmd/           # KMD Empire domain components (stat cards, ledgers, genealogy)
  │   │   ├── layout/        # App shell, sidebar navigation, route guards
  │   │   └── ui/            # Prebuilt and custom UI components, grouped by function
  │   ├── contexts/          # React context providers (auth session + member profile)
  │   ├── hooks/             # Custom React hooks
  │   ├── i18n/              # i18n runtime: config.ts (entry) + util.ts (helpers)
  │   ├── integrations/      # Generated Enter Cloud client and types (never edit by hand)
  │   ├── lib/               # Utility functions and libraries
  │   │   └── kmd/           # Domain types, formatters, label maps, constants, invoker
  │   ├── pages/             # Application pages (each page in its own subdirectory)
  │   │   ├── admin/         # Administrator console pages (/admin/*)
  │   │   ├── member/        # Member and retailer pages (/app/*)
  │   │   ├── landing/       # Public marketing page (/)
  │   │   ├── login/         # Username sign-in (/login)
  │   │   ├── register/      # Registration with referral capture (/register)
  │   │   └── forgot-password/ # Password reset request (/forgot-password)
  │   ├── App.tsx            # Main app component, sets up route providers
  │   ├── router.tsx         # Router config, sets up routing
  │   ├── main.tsx           # Entry point for the React app
  │   └── index.css          # Global styles
  ├── package.json           # Project metadata and scripts
  ├── tailwind.config.ts     # Tailwind CSS configuration
  └── ...                    # Other config and lock files
```

## KMD Empire module map

The application is a network-marketing business system whose compensation logic lives
entirely on the server. Keep this boundary when extending it.

- **supabase/functions/**: `register-member`, `account-lookup`, `member-actions`,
  `admin-actions`, `reward-diagnostics`, `seed-test-environment`, `run-required-tests`.
  Functions authorise the caller and then call a database function with `.rpc()`; they
  never contain raw SQL and never calculate a reward themselves.
- **Database functions** (created by migration, not on disk): `kmd_register_member`,
  `kmd_create_order`, `kmd_process_qualified_purchase` (the reward engine),
  `kmd_confirm_payment`, `kmd_reject_payment`, `kmd_set_order_status`,
  `kmd_request_redemption`, `kmd_review_redemption`, `kmd_convert_to_wallet`,
  `kmd_reconcile_member_balance`, `kmd_activate_member`, `kmd_reverse_reward`,
  `kmd_change_sponsor`, `kmd_adjust_points`, `kmd_update_reward_config`,
  `kmd_update_setting`, `kmd_diagnose_order`, `kmd_member_balances`, `kmd_audit`.
- **Ledger tables are append-only from the browser's point of view.** `point_ledger`,
  `loyalty_credit_ledger`, `shopping_wallet_ledger`, `redemptions` and `audit_logs` have
  no client write policy. The UI must go through a backend function.
- **Balances are derived, not stored authoritatively.** `src/hooks/use-member-ledger.ts`
  recomputes a member's balances from their own ledger rows using the same rule as
  `kmd_member_balances` (credits − posted debits − held debits).
- **`src/components/kmd/`**: `page-header`, `stat-card`, `data-table`, `amount`,
  `status-badge`, `empty-state`, `member-cell`, `loyalty-card`, `genealogy-tree`,
  `order-status-timeline`, `filter-bar`, `confirm-action-dialog`, `diagnostics-checklist`,
  `engine-result`.
- **`src/lib/kmd/`**: `types.ts` (domain types mirroring the tables), `format.ts`
  (points, peso, dates), `labels.ts` (status to label/tone maps), `constants.ts`,
  `invoke.ts` (normalised backend function caller).


> Backend-handoff temporary files (`scripts/`, `i18n.scan.json`, `reports/i18n/`, `docs/i18n-*.md`) are kept in the repo only until backend integration of i18n statistics/scan/auto-translate is complete. They are owned by the backend long-term and will be removed once integration lands. Treat them as read-only handoff copies — do not extend them.

## Directory Responsibilities

- **public/**: Static files served directly. Place images, icons, and robots.txt here.
- **public/locales/**: Translation files, one per language (`{code}.json`). Flat dotted keys (e.g. `home.hero.title`); the `fallbackLng` file is the structural source of truth.
- **i18n.config.json**: The lightweight i18n manifest for fallback language, language labels, browser detection aliases, and document direction. Single source of truth for the language list.
- **src/components/**: All UI components.  
  - **ui/**: Contains atomic and composite UI components.  
  - *Group related components into subdirectories if they share a domain or feature (e.g., `form/`, `charts/`).*
- **src/hooks/**: Custom React hooks. Each file should export a single hook focused on one responsibility.
- **src/i18n/**: Two files only.
  - `config.ts` is the runtime entry: imports the manifest via `util.ts`, initializes i18next (HTTP backend, language detector, react binding), syncs `<html lang/dir>`, and re-exports the helpers. Importing this file for its side effect boots i18next.
  - `util.ts` holds pure helpers parsed from the manifest: `fallbackLng`, `supportedLngs`, `languageOptions`, `normalizeLanguage`, `getLanguageDirection`, plus types.
  - Components use the official `useTranslation()` from `react-i18next` directly; there is no project-specific `useT` wrapper.
- **src/lib/**: Utility functions and libraries that are not React components or hooks.
- **src/pages/**: All route-level pages.  
  - *Each page should have its own subdirectory if it contains more than a single file or has related logic/components.*
- **src/App.tsx**: Sets up global providers.
- **src/router.tsx**: Sets up routing.
- **src/main.tsx**: Application entry point.

**Important:**
Whenever a new module (such as a component, hook, or utility) or a new page is added or removed, this document **must be updated immediately** to reflect the changes. Keeping this documentation up to date ensures that all collaborators have a clear understanding of the current project structure and its intended organization.

## How to Add New Code

### 1. Adding a New Page

- **Create a subdirectory under `src/pages/` for each new page.**
  - Example: For a "Dashboard" page, create `src/pages/dashboard/`.
- **Place the main page component as `index.tsx` inside the subdirectory.**
- **Add any page-specific components or logic in the same subdirectory.**
- **Register the new route in `src/router.tsx and generate a semantic name.**
  - Example:
    ```tsx
    import Dashboard from "./pages/dashboard";
    // ...
    {
      path: "/dashboard",
      name: 'dashboard',
      element: <Dashboard />
    }
    ```

### 2. Adding a New Component

- **If you are adding a group of related components, create a subdirectory (e.g., `form/`, `charts/`).**
- **If the component is only used by a specific page, place it in that page's subdirectory under `src/pages/`.**
- **Each component should be focused on a single responsibility.**
- **Small files (< 100 lines) are encouraged for a single component.**

### 3. Adding a New Hook

- **Create a new file in `src/hooks/` named after the hook (e.g., `use-feature.ts`).**
- **Each file should export only one hook.**
- **Hooks should be as small and focused as possible.**

### 4. Adding Utilities

- **Add utility functions to `src/lib/`.**
- **Group related utilities in the same file or subdirectory if needed.**

### 5. Adding or Updating Languages

- **Language metadata must go through `i18n.config.json`.**
- **Do not hardcode supported languages, labels, browser detection aliases, or RTL direction lists in `src/i18n/*.ts`.**
- **Locale content lives in `public/locales/{code}.json`** as flat dotted-key JSON; the `fallbackLng` file owns the canonical key set.
- **Runtime code reads the manifest only through `src/i18n/util.ts`.** Adding or removing a language means editing `i18n.config.json` plus the matching `public/locales/{code}.json`; nothing in `src/i18n/` needs to change.
- **Translations are read with the official `useTranslation()` from `react-i18next`.** No custom hook, no cast at call sites.

## Coding Best Practices

- **One module, one responsibility:**  
  Each file (component, hook, utility) should do one thing only.
- **High cohesion, low coupling:**  
  Keep related logic together and avoid unnecessary dependencies between modules.
- **Naming conventions:**  
  - Use `PascalCase` for components and page directories.
  - Use `camelCase` for hooks and utility functions.
  - Name page subdirectories and files after their route or feature.
- **Component structure:**  
  - Keep components small and focused.
  - Extract subcomponents if a component grows too large.
- **Page structure:**  
  - Place all logic, hooks, and components specific to a page in its subdirectory.
  - Only share code via `components/`, `hooks/`, or `lib/` if it is truly reusable.
- **Documentation:**  
  - Add comments for complex logic.
  - Document the purpose of each module at the top of the file if not obvious.

## Example: Adding a New "Profile" Page

1. **Create a directory:**  
   `src/pages/profile/`
2. **Add the main page component:**  
   `src/pages/profile/index.tsx`
3. **Add page-specific components:**  
   `src/pages/profile/ProfileHeader.tsx`, `src/pages/profile/ProfileDetails.tsx`
4. **Register the route in `App.tsx`:**
   ```tsx
   import Profile from "./pages/profile";
   // ...
   <Route path="/profile" element={<Profile />} />
   ```
5. **If you need a reusable button, add it to `src/components/ui/button.tsx`.**
