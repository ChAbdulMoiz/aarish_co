# Aarish Co. + Aarish Jewelry

Static, responsive multi-brand storefront for:

- **Aarish Co.** — premium men's clothing.
- **Aarish Jewelry** — everyday jewellery.

The project keeps the existing HTML/CSS/JavaScript/Supabase stack. It includes a mixed-brand cart, cash-on-delivery checkout, owner authentication, separate product workflows, image uploads, inventory, order filtering, and server-side checkout price validation.

## Supabase setup

1. Run the existing `supabase/schema.sql` once in the Supabase SQL Editor if the project is new.
2. Run `supabase/20261122_aarish_multibrand.sql`. It is additive: it adds brand/product-image/category/variant/inventory fields, updates the checkout RPC, changes order statuses to `pending`, `confirmed`, `processing`, `shipped`, `delivered`, and `cancelled`, and archives known restaurant rows from the storefront without deleting them.
3. In **Authentication → Users**, create the owner email/password account.
4. Add its UUID to `public.store_owners`:

```sql
insert into public.store_owners(user_id)
values ('OWNER-AUTH-USER-UUID');
```

5. Confirm the `product-images` bucket is public for product display. The migration creates owner-only upload/update/delete policies.
6. Put only the Supabase project URL and publishable/anon key in `js/config.js`. Never expose a service-role key.

The migration must be run before using the brand-aware storefront or owner product forms. No destructive SQL is included.

## Local/deployment

This is a no-build static site. Open `index.html` through a static server or deploy the repository to Vercel/GitHub Pages. The relative `./` and `../` paths support repository subdirectories and `/owner/`.

For Vercel, use the **Other** preset with no build command and `.` as the output directory. For GitHub Pages, publish the repository root.

## Security notes

- Public users can read only available products, public settings, categories, and images.
- Customers do not receive direct order-table access; checkout runs through the `place_order` security-definer RPC.
- The RPC recalculates current sale/regular prices and validates availability before creating order items. It stores each item's brand.
- Only users listed in `store_owners` can manage products, images, inventory, settings, and orders.
- Cash on delivery is the only payment method; the UI does not claim an online payment succeeded.

## Audit summary

The original project was a compact restaurant storefront with a Supabase product table, cart, checkout RPC, owner auth, product CRUD, storage upload, and order status dashboard. The transformation preserves those primitives while replacing restaurant content with brand-aware collections, separate clothing/jewellery forms, mixed-brand order lines, and the Aarish visual system.
