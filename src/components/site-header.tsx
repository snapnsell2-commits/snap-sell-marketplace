import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, LayoutGrid, LogOut, Menu, Plus, Search, User as UserIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-xl bg-primary font-display text-lg font-extrabold text-primary-foreground">
        S
      </span>
      <span className="font-display text-xl font-extrabold tracking-tight">Snap &amp; Sell</span>
    </Link>
  );
}

export function SiteHeader() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void navigate({ to: "/browse", search: { q: term || undefined } });
    setOpen(false);
  };

  const initials = (profile?.display_name ?? profile?.username ?? user?.email ?? "S")
    .slice(0, 1)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center gap-3">
        <Logo />

        <form onSubmit={submit} className="relative ml-4 hidden flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search cameras, jackets, bikes…"
            aria-label="Search listings"
            className="h-10 rounded-full pl-9"
          />
        </form>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          <Button variant="ghost" asChild>
            <Link to="/browse">Browse</Link>
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full" asChild>
            <Link to="/wishlist" aria-label="Wishlist">
              <Heart className="size-5" />
            </Link>
          </Button>
          <ThemeToggle />
          <Button asChild className="rounded-full">
            <Link to="/sell">
              <Plus className="size-4" /> Sell
            </Link>
          </Button>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 rounded-full ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <Avatar className="size-9">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="truncate">
                  {profile?.display_name ?? profile?.username ?? user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">
                    <LayoutGrid className="size-4" /> My listings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <UserIcon className="size-4" /> Edit profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" className="rounded-full" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm">
              <SheetTitle className="px-4 pt-4">Menu</SheetTitle>
              <div className="flex flex-col gap-2 p-4">
                <form onSubmit={submit} className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Search listings"
                    aria-label="Search listings"
                    className="h-10 rounded-full pl-9"
                  />
                </form>
                <Button variant="ghost" className="justify-start" asChild onClick={() => setOpen(false)}>
                  <Link to="/browse">Browse</Link>
                </Button>
                <Button variant="ghost" className="justify-start" asChild onClick={() => setOpen(false)}>
                  <Link to="/wishlist">Wishlist</Link>
                </Button>
                <Button className="justify-start" asChild onClick={() => setOpen(false)}>
                  <Link to="/sell">Sell an item</Link>
                </Button>
                {user ? (
                  <>
                    <Button variant="ghost" className="justify-start" asChild onClick={() => setOpen(false)}>
                      <Link to="/dashboard">My listings</Link>
                    </Button>
                    <Button variant="ghost" className="justify-start" asChild onClick={() => setOpen(false)}>
                      <Link to="/profile">Edit profile</Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start"
                      onClick={() => {
                        setOpen(false);
                        void signOut();
                      }}
                    >
                      Sign out
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" className="justify-start" asChild onClick={() => setOpen(false)}>
                    <Link to="/auth">Sign in</Link>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
