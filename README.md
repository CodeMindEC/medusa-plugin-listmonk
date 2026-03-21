# @codemind.ec/medusa-plugin-listmonk

Medusa v2 notification provider for **Listmonk** — transactional emails with template mapping, automatic subscriber management, and attachment support.

[![npm version](https://img.shields.io/npm/v/@codemind.ec/medusa-plugin-listmonk.svg)](https://www.npmjs.com/package/@codemind.ec/medusa-plugin-listmonk)
[![Medusa v2](https://img.shields.io/badge/medusa-v2-blueviolet)](https://docs.medusajs.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Features

- **Transactional emails** — sends emails via Listmonk's `/api/tx` endpoint.
- **Template mapping** — map semantic template names (e.g., `"order-placed"`) to Listmonk template IDs.
- **Auto subscriber management** — automatically creates Listmonk subscribers on first email send.
- **Basic Auth** — secure authentication with Listmonk API.
- **Attachments** — supports file attachments (Buffer or base64).
- **Configurable** — full control over sender, list assignment, and template resolution.

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js     | >= 20   |
| Medusa      | >= 2.4.0 |
| Listmonk    | any     |

---

## Installation

```bash
npm install @codemind.ec/medusa-plugin-listmonk
# or
pnpm add @codemind.ec/medusa-plugin-listmonk
```

---

## Configuration

Add the plugin to your `medusa-config.ts`:

```typescript
import { defineConfig } from "@medusajs/framework/utils"

export default defineConfig({
  // ...
  plugins: [
    {
      resolve: "@codemind.ec/medusa-plugin-listmonk",
      options: {
        url: process.env.LISTMONK_URL,
        username: process.env.LISTMONK_USERNAME,
        password: process.env.LISTMONK_PASSWORD,
        from_email: process.env.LISTMONK_FROM_EMAIL,
        list_id: process.env.LISTMONK_LIST_ID,
        template_map: {
          "order-placed": 10,
          "order-updated": 11,
          "payment-captured": 12,
          "receipt-uploaded": 13,
        },
      },
    },
  ],
})
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LISTMONK_URL` | Yes | Listmonk instance URL (e.g., `https://listmonk.example.com`) |
| `LISTMONK_USERNAME` | No | Basic Auth username |
| `LISTMONK_PASSWORD` | No | Basic Auth password |
| `LISTMONK_FROM_EMAIL` | No | Default sender email |
| `LISTMONK_LIST_ID` | No | Default list ID for new subscribers |

### Options Reference

| Option | Type | Description |
|--------|------|-------------|
| `url` | string | **Required.** Listmonk instance URL |
| `username` | string? | Basic Auth username |
| `password` | string? | Basic Auth password |
| `from_email` | string? | Default sender email |
| `list_id` | string? | Listmonk list ID for subscriber assignment |
| `template_map` | `Record<string, string \| number>`? | Map of semantic names → Listmonk template IDs |

---

## How It Works

### Provider Identifier

`notification-listmonk`

### Send Flow

When `notificationModuleService.createNotifications()` is called:

1. **Validate** — `to` (recipient) and `template` (or `data.template_id`) are required.
2. **Resolve template ID** — priority: `data.template_id` > `template_map[template]` > `template`.
3. **Ensure subscriber** — calls Listmonk API to create/find subscriber by email. Extracts name from customer data or shipping address. Sets `attribs: { source: "medusa" }`.
4. **Send email** — POST to `/api/tx` with:
   ```json
   {
     "subscriber_email": "customer@example.com",
     "template_id": 10,
     "data": { "order_id": "123", "total": "100.00" },
     "content_type": "html"
   }
   ```
5. **Return** — `{ id: "listmonk-tx-{timestamp}" }`

### Authentication

If `username` and `password` are configured, all requests include a Basic Auth header. Timeout: 15 seconds.

---

## Usage

### In a Subscriber

```typescript
import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

export default async function orderPlacedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const notificationService = container.resolve(Modules.NOTIFICATION)

  await notificationService.createNotifications({
    to: "customer@example.com",
    template: "order-placed",   // resolves via template_map → Listmonk ID
    channel: "email",
    data: {
      order_id: event.data.id,
      customer_name: "John Doe",
      total: "$150.00",
    },
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
```

### With Explicit Template ID

```typescript
await notificationService.createNotifications({
  to: "customer@example.com",
  template: "15",  // direct Listmonk template ID
  channel: "email",
  data: {
    order_id: "ord_123",
  },
})
```

### With Attachments

```typescript
await notificationService.createNotifications({
  to: "customer@example.com",
  template: "invoice",
  channel: "email",
  data: { order_id: "ord_123" },
  attachments: [
    {
      filename: "invoice.pdf",
      content: pdfBuffer,          // Buffer or base64 string
      content_type: "application/pdf",
    },
  ],
})
```

---

## Error Handling

- Invalid template IDs are logged but don't throw.
- Subscriber creation errors are ignored (subscriber may already exist).
- Network errors are propagated to the caller.

---

## License

MIT — [CodeMind](https://codemind.ec)
