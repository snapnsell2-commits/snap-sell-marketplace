# Snap & Sell — Marketplace Build Plan

A modern, responsive marketplace with buying-side browsing and selling-side listing management, powered by your own Supabase project (database, logins, image storage).

## What the app will do

**Accounts**
- Sign up / sign in with email + password, or with Google
- Every account gets a profile: profile picture, username, bio, location
- Profile editing page

**Selling**
- Create a listing: multiple photos, title, description, price, category, condition (new / like new / good / fair), quantity
- Manage your listings (edit, mark sold, delete) from a dashboard

**Browsing**
- Home page with featured and latest listings
- Search by keyword
- Filter by category, condition, price range; sort by newest/price
- Product detail page with image gallery, price, condition, quantity, seller card
- Public seller profile page showing their active listings and bio
- Wishlist (save / unsave items, dedicated page)
- Recently viewed strip, saved per account

**Design**
- Distinct visual identity (not a generic template look), full dark + light mode with a toggle
- Works on phone, tablet, and desktop

## Pages

| Page | Purpose |
|---|---|
| `/` | Home: hero, category tiles, featured + latest listings, recently viewed |
| `/browse` | Search results with filters and sorting |
| `/product/$id` | Product detail |
| `/seller/$username` | Public seller profile |
| `/auth` | Sign in / sign up |
| `/wishlist` | Saved items (signed in) |
| `/sell` | Create a listing (signed in) |
| `/dashboard` | My listings (signed in) |
| `/profile` | Edit my profile (signed in) |

## Backend: your own Supabase project

This app will use your existing Supabase project rather than the built-in backend. Before I can build the data layer, connect it in **Project Settings → Connectors → Supabase** (a quick browser sign-in) — I can't link it from chat. Once it's connected I'll create the tables, security rules, storage buckets, and seeded categories there.

Note: email sign-in and Google sign-in are switched on in your Supabase dashboard (Authentication → Providers), including the Google client ID/secret and the allowed redirect URLs. I'll tell you the exact values to paste when we get there.

## Data structure

- `profiles` — one per account: username (unique), display name, avatar, bio, location; auto-created on signup
- `categories` — name, slug, icon; seeded with common marketplace categories
- `listings` — seller, title, description, price, category, condition, quantity, status (active/sold/draft), timestamps
- `listing_images` — multiple images per listing with sort order and a primary flag
- `wishlists` — account + listing, unique pair
- `recently_viewed` — account + listing + viewed time, newest kept per account
- Storage buckets for avatars and listing photos

Security: row-level rules so anyone can read active listings and public profiles, but only the owner can create/edit/delete their own listings, images, wishlist, and viewing history. Every table gets explicit access grants.

## Technical notes

- TanStack Start routes; public pages server-rendered with their own titles/descriptions for search and sharing
- Public reads go through a publishable-key server client behind narrow anon read policies; all writes and personal data go through authenticated server functions
- Protected pages live under the authenticated layout; email + Google providers enabled in your Supabase dashboard, Google via standard OAuth redirect
- Images uploaded straight to Cloud storage from the browser with client-side resizing before upload
- Theme via a class-based dark mode toggle persisted per browser, all colors as semantic tokens in the design system

## Build order

1. Connect your Supabase project, then database schema + policies + seeded categories, storage buckets
2. Design system (tokens, typography, dark/light), app shell with header/nav/footer and theme toggle
3. Auth (email + Google) and profile creation/editing
4. Listing creation with multi-image upload, seller dashboard
5. Home, browse/search/filters, product detail, seller profile
6. Wishlist, recently viewed
7. Responsive polish and metadata pass
