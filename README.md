# Medusa Listmonk Notification Plugin

This plugin integrates Listmonk transactional emails (`/api/tx`) into Medusa.

## Features

- Sends transactional emails via Listmonk API.
- Supports generic `template_id` mapping.
- Supports authenticated requests (Basic Auth).

## Configuration

1.  Add the plugin to your `medusa-config.ts`:

```typescript
module.exports = {
  // ...
  plugins: [
    // ...
    {
      resolve: "medusa-notification-listmonk",
      options: {
        url: process.env.LISTMONK_URL,
        username: process.env.LISTMONK_USERNAME,
        password: process.env.LISTMONK_PASSWORD,
        from_email: process.env.LISTMONK_FROM_EMAIL,
      },
    },
  ],
}
```

2.  Configure your environment variables in `.env`:

```bash
LISTMONK_URL="https://your-listmonk-instance.com"
LISTMONK_USERNAME="your-username"
LISTMONK_PASSWORD="your-password"
LISTMONK_FROM_EMAIL="noreply@yourstore.com"
```

## Usage in Subscribers

When creating notifications, pass the Listmonk Template ID (integer) or key as the `template` property, or inside the `data` payload if you prefer dynamic mapping.

```typescript
await notificationModuleService.createNotifications({
  to: "customer@example.com",
  template: "15", // Listmonk Template ID
  channel: "email",
  data: {
    // Dynamic data for the template
    order_id: "123",
    total: "100.00",
    customer_name: "John Doe"
  }
})
```
