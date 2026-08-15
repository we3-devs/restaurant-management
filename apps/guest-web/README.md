# Guest Web App

QR-based menu ordering for restaurant customers.

## Setup

```bash
pnpm install
pnpm dev
```

Guest app runs on `http://localhost:3200`

## QR Format

QR encodes a URL like: `http://localhost:3200?table=T1`

Where `T1` is the table code printed on the table.

## Pages

- `/` - QR redirect landing
- `/menu?table=T1` - Menu & ordering
- `/order?table=T1` - Order tracking
