# @celestia/widget

The Celestia Bridge widget is a reusable React component for bridging, swapping, and transferring assets across the Celestia ecosystem. It supports multiple chains (EVM, Cosmos, Solana) and can be integrated via npm or embedded in your application.

## Prerequisites

- **React 18+** (required)
- **Node.js ≥ 18.18**

The widget relies on the consuming app to provide wallet connection (EVM, Cosmos, Solana) and WalletConnect configuration. Ensure your app already has wallet providers (e.g. wagmi, Graz, Solana wallet adapters) and Wrap `WidgetProvider` around your app or the widget container.

---

## NPM Integration

### 1. Install the package

**From workspace (monorepo):**

```json
{
  "dependencies": {
    "@celestia/widget": "workspace:*"
  }
}
```

**From registry (when published):**

```bash
pnpm add @celestia/widget
# or
npm install @celestia/widget
# or
yarn add @celestia/widget
```

### 2. Import styles

Import the widget styles **once** in your app (e.g. in `layout.tsx` or `_app.tsx`):

```tsx
import "@celestia/widget/styles.css";
```

### 3. Wrap with WidgetProvider

The widget requires a `WidgetProvider` that provides a `connectWallet` callback and optional config:

```tsx
import { Widget, WidgetProvider } from "@celestia/widget";

// Your wallet connect handler - opens your app's wallet modal/connect flow
const handleConnectWallet = () => {
  // e.g. open ConnectKit/Web3Modal/etc.
  setIsWalletModalOpen(true);
};

function App() {
  return (
    <WidgetProvider connectWallet={handleConnectWallet}>
      <Widget />
    </WidgetProvider>
  );
}
```

### 4. WidgetProvider Props

| Prop                      | Type         | Required | Description                                              |
| ------------------------- | ------------ | -------- | -------------------------------------------------------- |
| `connectWallet`           | `() => void` | Yes      | Callback when user clicks "Connect Wallet" in the widget |
| `isTestnet`               | `boolean`    | No       | Use testnet chains (default: `false`)                    |
| `defaultSourceChain`      | `ChainRef`   | No       | Pre-select source chain                                  |
| `defaultSourceToken`      | `TokenRef`   | No       | Pre-select source token                                  |
| `defaultDestinationChain` | `ChainRef`   | No       | Pre-select destination chain                             |
| `defaultDestinationToken` | `TokenRef`   | No       | Pre-select destination token                             |
| `defaultTab`              | `Tabs`       | No       | `Tabs.FAST` or `Tabs.ADVANCED`                           |
| `showDefaultTabOnly`      | `boolean`    | No       | Hide tab switcher and show only `defaultTab`             |

**ChainRef / TokenRef:**

```ts
type ChainRef = { key: string; displayName: string; logoURI?: string; chainType?: SupportedProtocols };
type TokenRef = { key: string; symbol: string; name?: string; logoURI?: string; coingeckoId?: };
```

### 5. Widget Props

| Prop             | Type                       | Description                                      |
| ---------------- | -------------------------- | ------------------------------------------------ |
| `className`      | `string`                   | Optional CSS class for the widget container      |
| `onStatusChange` | `(status: Screen) => void` | Optional callback when the widget screen changes |

### 6. Complete example (Next.js App Router)

```tsx
"use client";

import { Widget, WidgetProvider } from "@celestia/widget";
import { Tabs } from "@celestia/widget";

export default function BridgePage() {
  const handleConnectWallet = () => {
    // Open your wallet connection UI
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <WidgetProvider
        connectWallet={handleConnectWallet}
        isTestnet={true}
        defaultTab={Tabs.FAST}
      >
        <Widget className="max-md:!w-full" />
      </WidgetProvider>
    </div>
  );
}
```

---

## Embed Integration

You can embed the widget in two ways:

### Option A: Embed via iframe (standalone page)

Host a dedicated route that renders only the widget (e.g. `/embed/widget`). Third parties can embed it via iframe:

```html
<iframe
  src="https://your-bridge-domain.com/embed/widget"
  width="100%"
  height="700"
  frameborder="0"
  allow="clipboard-write"
  sandbox="allow-scripts allow-same-origin"
></iframe>
```

**Notes:**

- The embed page must render `Widget` + `WidgetProvider` and import `@celestia/widget/styles.css`.
- Ensure your app’s wallet providers (wagmi, Graz, Solana) wrap the embed layout so the widget can access wallet state.
- Query params (e.g. `?sourceChainId=...&destinationChainId=...`) can be parsed and passed as `defaultSourceChain` / `defaultDestinationChain` if you support them.

### Option B: Embed as React component (SSR/SPA)

If your embed target is a React app, use the npm integration above. The widget is a React component; configure your build to bundle it or consume it from a CDN-hosted ESM build (if you publish one).

---

## Environment variables

The widget uses environment variables at build time. Configure them in the consuming app or when building the widget:

| Variable                       | Description                                      |
| ------------------------------ | ------------------------------------------------ |
| `VITE_WALLET_CONNECT_ID`       | WalletConnect project ID                         |
| `VITE_REGISTRY_URL`            | Hyperlane registry URL                           |
| `VITE_REGISTRY_BRANCH`         | Hyperlane registry branch                        |
| `VITE_GITHUB_PROXY`            | GitHub proxy URL                                 |
| `VITE_LEAP_API_BASE_URL`       | Leap API base URL                                |
| `VITE_TRANSFER_BLACKLIST`      | Comma-separated blacklist                        |
| `VITE_CHAIN_WALLET_WHITELISTS` | JSON string for chain-specific wallet whitelists |
| `VITE_RPC_OVERRIDES`           | JSON string for RPC overrides                    |

Copy `packages/widget/.env.example` to `.env` and fill in values before building.

---

## Build outputs

The widget builds to `dist/` with:

- `index.es.js` – ESM bundle
- `index.cjs` – CommonJS bundle
- `index.d.ts` – TypeScript declarations
- `styles.css` – Styles

**Package exports:**

```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.es.js",
    "default": "./dist/index.cjs"
  },
  "./dev": {
    "types": "./src/index.ts",
    "import": "./src/index.ts",
    "default": "./src/index.ts"
  },
  "./styles.css": {
    "import": "./dist/styles.css",
    "default": "./dist/styles.css"
  }
}
```

---

## Development

```bash
# From repo root
pnpm dev:widget          # Watch build for hot reload with consuming apps
pnpm build:widget        # Production build

# From packages/widget
cd packages/widget
pnpm dev                 # Watch build
pnpm build               # Production build
pnpm preview             # Preview built output
```

Use `@celestia/widget/dev` for development builds that point to source (no pre-build):

```ts
import { Widget, WidgetProvider } from "@celestia/widget/dev";
```

---

## Wallet requirements

The widget expects the host app to provide:

- **EVM**: wagmi (or compatible) with connected account
- **Cosmos**: Graz with connected accounts
- **Solana**: Solana wallet adapter (e.g. `@solana/wallet-adapter-react`) with connected wallet

`connectWallet` is called when the user tries to connect; the host app owns the actual connection UI and logic.
