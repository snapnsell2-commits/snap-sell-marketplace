import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t bg-surface">
      <div className="container-page flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-extrabold">Snap &amp; Sell</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Snap a photo, set a price, sell it today.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link to="/browse" className="hover:text-foreground">
            Browse
          </Link>
          <Link to="/sell" className="hover:text-foreground">
            Sell
          </Link>
          <Link to="/wishlist" className="hover:text-foreground">
            Wishlist
          </Link>
          <Link to="/auth" className="hover:text-foreground">
            Account
          </Link>
        </nav>
      </div>
      <div className="container-page pb-8 text-xs text-muted-foreground">
        © {new Date().getFullYear()} Snap &amp; Sell. All rights reserved.
      </div>
    </footer>
  );
}
