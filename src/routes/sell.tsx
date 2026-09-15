import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ImagePlus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { createListing, fetchCategories } from "@/lib/marketplace";
import { CONDITIONS } from "@/lib/types";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "List an item — Snap & Sell" },
      {
        name: "description",
        content: "Add photos, a price and a description to put your item in front of local buyers.",
      },
      { property: "og:title", content: "List an item — Snap & Sell" },
      {
        property: "og:description",
        content: "Snap a few photos, set your price and list an item in minutes.",
      },
    ],
  }),
  component: SellPage,
});

function SellPage() {
  const navigate = useNavigate();
  const { user, configured } = useAuth();
  const categories = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("good");
  const [quantity, setQuantity] = useState("1");
  const [location, setLocation] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="font-display text-3xl font-extrabold">Sign in to list an item</h1>
        <p className="mt-2 text-muted-foreground">
          {configured ? "You need an account to sell." : "Listings turn on once your database is connected."}
        </p>
        <Button className="mt-6 rounded-full" asChild>
          <Link to="/auth">Sign in</Link>
        </Button>
      </div>
    );
  }

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 8));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!category) return toast.error("Pick a category.");
    setBusy(true);
    try {
      const id = await createListing(user.id, {
        title,
        description,
        price: Number(price),
        category_slug: category,
        condition,
        quantity: Number(quantity) || 1,
        location: location || null,
        images: files,
      });
      toast.success("Your listing is live!");
      void navigate({ to: "/product/$id", params: { id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the listing.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page max-w-2xl py-10">
      <h1 className="font-display text-3xl font-extrabold">List an item</h1>
      <p className="mt-2 text-muted-foreground">Good photos and an honest description sell fastest.</p>

      <form onSubmit={submit} className="mt-8 grid gap-5">
        <div className="grid gap-2">
          <Label>Photos</Label>
          <div className="flex flex-wrap gap-3">
            {files.map((file, i) => (
              <div key={`${file.name}-${i}`} className="relative size-24 overflow-hidden rounded-2xl border">
                <img src={URL.createObjectURL(file)} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-background/90"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            <label className="grid size-24 cursor-pointer place-items-center rounded-2xl border border-dashed text-muted-foreground hover:border-primary hover:text-primary">
              <ImagePlus className="size-6" />
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Canon AE-1 film camera" />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="price">Price (USD)</Label>
            <Input id="price" type="number" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="quantity">Quantity</Label>
            <Input id="quantity" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger>
              <SelectContent>
                {(categories.data ?? []).map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Condition</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Austin, TX" />
        </div>

        <Button type="submit" disabled={busy} size="lg" className="mt-2 rounded-full">
          {busy ? "Publishing…" : "Publish listing"}
        </Button>
      </form>
    </div>
  );
}
