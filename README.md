# Savor & Co. — Restaurant Storefront

A reusable restaurant ordering website with a customer storefront and a protected owner dashboard.

## Features

### Customer storefront
- Browse menu items, categories, photos, descriptions and prices.
- Add items to a cart and change quantities.
- Checkout with customer name, phone, email, delivery address and notes.
- Cash on delivery.
- Order totals and prices are recalculated in a PostgreSQL function on the server; browser-submitted prices are never trusted.

### Owner studio (`/owner/`)
- Separate email/password sign-in through Supabase Auth.
- Overview of orders and menu items.
- View customer orders and update statuses: new, confirmed, preparing, out for delivery, completed, cancelled.
- Add, edit, delete, feature and hide products.
- Upload JPG/PNG/WEBP product images (max 5 MB).
- Edit store name, tagline, contact details, address and delivery fee.

## Stack

- Static HTML/CSS/JavaScript hosted on Vercel.
- Supabase PostgreSQL, Auth, Row Level Security and Storage.
- No build step or framework required.

## Setup

### 1. Create Supabase project
1. Create a project at https://supabase.com/.
2. Open **SQL Editor → New query**.
3. Paste and run all of `supabase/schema.sql`.
4. In **Project Settings → API**, copy the Project URL and anon/publishable key.

### 2. Configure browser client
Open `js/config.js` and replace:
- `YOUR_SUPABASE_PROJECT_URL`
- `YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY`

Use only the anon/publishable key in browser code. Never put a `service_role` key in this repository or in frontend JavaScript.

### 3. Create the store owner login
1. In Supabase, open **Authentication → Users → Add user**.
2. Create the shop owner's email/password account.
3. Copy that user's UUID.
4. In Supabase SQL Editor, run this, replacing the UUID:

```sql
insert into public.store_owners(user_id)
values ('PASTE-AUTH-USER-UUID-HERE');
```

Only users listed in `store_owners` can access orders, manage products/settings, and upload images. The owner dashboard is not a public admin page.

### 4. Deploy to Vercel
1. Push this folder to a GitHub repository.
2. Sign in to https://vercel.com/ and choose **Add New → Project**.
3. Import the GitHub repository.
4. Framework preset: **Other**. Build command: leave empty. Output directory: `.` (root).
5. Deploy. Vercel will host `index.html` and `/owner/` as static pages.

The Supabase URL and anon key are configured in `js/config.js`, so no server-side environment variable is required for this static build.

### 5. Verify before sharing
- Open the storefront and confirm the six sample products load.
- Add a product and place a test order.
- Sign in at `/owner/` with the owner account and verify the order appears.
- Change an order status and add/edit a product.
- Test the site in a private/incognito browser to confirm customers cannot open the owner dashboard data.

## Important security notes
- Do not disable Row Level Security.
- Do not grant anonymous users direct access to orders or order items.
- Do not expose a Supabase `service_role` key.
- The owner must be added to `store_owners`; merely having a Supabase account does not grant owner privileges.
- Configure Supabase Auth email/password policies and strong passwords before production use.
- This prototype uses cash on delivery only. No online card/payment gateway is configured.
- Email notifications are not included in this independent build. They can be added later using a trusted server-side email provider/Edge Function.

## Customising for another restaurant
Update the initial `store_settings` row in Supabase, replace menu products in the `products` table, and adjust brand text/images in `index.html` and `styles.css`. The owner can also update store details and menu items through the dashboard.
