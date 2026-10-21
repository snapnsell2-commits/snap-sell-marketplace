import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ImagePlus, Mic, Send, Smile, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import {
  fetchConversations,
  fetchMessages,
  markConversationRead,
  sendMessage,
  uploadChatMedia,
} from "@/lib/chat";
import { MAX_UPLOAD_BYTES, resizeImage } from "@/lib/images";
import { supabase } from "@/lib/supabase";
import { timeAgo, type Conversation, type Message, type Profile } from "@/lib/types";
import { cn, errorMessage } from "@/lib/utils";

const EMOJI = ["😀","😂","🥰","😎","👍","🙏","🔥","🎉","💸","📦","✅","❌","❤️","👀","🤝","😅"];

export const Route = createFileRoute("/messages")({
  validateSearch: (search: Record<string, unknown>) => ({
    c: typeof search['c'] === "string" ? (search['c'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Messages — Snap & Sell" },
      {
        name: "description",
        content: "Chat with buyers and sellers in real time — photos, voice notes and read receipts included.",
      },
      { property: "og:title", content: "Messages — Snap & Sell" },
      { property: "og:description", content: "Your Snap & Sell conversations, updated live." },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { c } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const conversations = useQuery({
    queryKey: ["conversations", user?.id ?? null],
    queryFn: () => fetchConversations(user!.id),
    enabled: Boolean(user),
  });

  // A chat that was only just created isn't in the cached list yet — fetch again once.
  const { refetch } = conversations;
  const known = Boolean(c && conversations.data?.some((r) => r.id === c));
  const [retried, setRetried] = useState<string | null>(null);
  useEffect(() => {
    if (c && conversations.data && !known && retried !== c) {
      setRetried(c);
      void refetch();
    }
  }, [c, conversations.data, known, retried, refetch]);

  if (loading) {
    return <div className="container-page py-24 text-center text-muted-foreground">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="font-display text-3xl font-extrabold">Sign in to see your messages</h1>
        <Button className="mt-6 rounded-full" asChild>
          <Link to="/auth" search={{ redirect: "/messages" }}>Sign in</Link>
        </Button>
      </div>
    );
  }

  const rows = conversations.data ?? [];
  const active = rows.find((r) => r.id === c) ?? null;

  return (
    <div className="container-page py-8">
      <h1 className="mb-5 font-display text-3xl font-extrabold">Messages</h1>
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className={cn("rounded-3xl border bg-card", active && "hidden lg:block")}>
          {rows.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No conversations yet. Start one from any listing.
            </p>
          )}
          <ul className="divide-y">
            {rows.map((conv) => {
              const other = conv.buyer_id === user.id ? conv.seller : conv.buyer;
              return (
                <li key={conv.id}>
                  <button
                    onClick={() => void navigate({ to: "/messages", search: { c: conv.id } })}
                    className={cn(
                      "flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted",
                      conv.id === c && "bg-muted",
                    )}
                  >
                    <Avatar className="size-10">
                      <AvatarImage src={other?.avatar_url ?? undefined} alt="" />
                      <AvatarFallback>{(other?.username ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">
                          {other?.display_name ?? other?.username ?? "User"}
                        </span>
                        {(conv.unread ?? 0) > 0 && (
                          <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                            {conv.unread}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {conv.listing?.title ?? "Direct message"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {previewText(conv.last_message)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {active ? (
          <ChatWindow key={active.id} conversation={active} meId={user.id} />
        ) : (
          <div className="hidden place-items-center rounded-3xl border border-dashed p-10 text-muted-foreground lg:grid">
            Pick a conversation to start chatting.
          </div>
        )}
      </div>
    </div>
  );
}

function previewText(message: Message | null | undefined) {
  if (!message) return "No messages yet";
  if (message.kind === "image") return "📷 Photo";
  if (message.kind === "voice") return "🎤 Voice note";
  return message.body ?? "";
}

function ChatWindow({ conversation, meId }: { conversation: Conversation; meId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const other: Profile | null | undefined =
    conversation.buyer_id === meId ? conversation.seller : conversation.buyer;

  const [text, setText] = useState("");
  const [online, setOnline] = useState(false);
  const [typing, setTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const bottom = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  const query = useQuery({
    queryKey: ["messages", conversation.id],
    queryFn: () => fetchMessages(conversation.id),
  });

  const messages: Message[] = query.data ?? [];

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // read receipts: mark incoming messages read whenever the thread is open
  useEffect(() => {
    if (!messages.some((m) => m.sender_id !== meId && !m.read_at)) return;
    void markConversationRead(conversation.id, meId).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["conversations", meId] });
    });
  }, [messages, conversation.id, meId, queryClient]);

  // realtime messages + presence (online status) + typing indicator
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel(`chat:${conversation.id}`, {
      config: { presence: { key: meId } },
    });
    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnline(Object.keys(state).some((key) => key !== meId));
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        const from = (payload['payload'] as { from: string } | undefined)?.from;
        if (from && from !== meId) {
          setTyping(true);
          window.clearTimeout(typingTimer.current);
          typingTimer.current = window.setTimeout(() => setTyping(false), 2500);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ online_at: new Date().toISOString() });
      });

    return () => {
      window.clearTimeout(typingTimer.current);
      void supabase?.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversation.id, meId, queryClient]);

  // Leaving the chat mid-recording must release the microphone.
  useEffect(
    () => () => {
      const rec = recorder.current;
      if (rec && rec.state !== "inactive") {
        rec.onstop = null;
        rec.stop();
        rec.stream.getTracks().forEach((t) => t.stop());
      }
    },
    [],
  );

  const notifyTyping = useMemo(() => {
    let last = 0;
    return () => {
      const now = Date.now();
      if (now - last < 1500) return;
      last = now;
      void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { from: meId } });
    };
  }, [meId]);

  const send = async (payload: Partial<Message> & { kind?: Message["kind"] }) => {
    try {
      await sendMessage({
        conversationId: conversation.id,
        senderId: meId,
        kind: payload.kind ?? "text",
        body: payload.body ?? null,
        attachmentUrl: payload.attachment_url ?? null,
        durationMs: payload.duration_ms ?? null,
      });
      void queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
      void queryClient.invalidateQueries({ queryKey: ["conversations", meId] });
    } catch (error) {
      toast.error(errorMessage(error, "Message failed to send."));
    }
  };

  const sendImage = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (file.size > MAX_UPLOAD_BYTES) return toast.error("That photo is too large (25 MB max).");
    try {
      const body = await resizeImage(file);
      const url = await uploadChatMedia(meId, conversation.id, body, file.name);
      await send({ kind: "image", attachment_url: url });
    } catch (error) {
      toast.error(errorMessage(error, "Upload failed."));
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const mime = (rec.mimeType || "audio/webm").split(";")[0] ?? "audio/webm";
      const chunks: BlobPart[] = [];
      const started = Date.now();
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mime });
        if (blob.size === 0) return;
        try {
          const url = await uploadChatMedia(meId, conversation.id, blob);
          await send({ kind: "voice", attachment_url: url, duration_ms: Date.now() - started });
        } catch (error) {
          toast.error(errorMessage(error, "Could not send the voice note."));
        }
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      toast.error("Microphone access is needed for voice notes. Check your browser permissions.");
    }
  };

  return (
    <section className="flex h-[70vh] flex-col rounded-3xl border bg-card">
      <header className="flex items-center gap-3 border-b p-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full lg:hidden"
          aria-label="Back to conversations"
          onClick={() => void navigate({ to: "/messages", search: { c: undefined } })}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <Avatar className="size-10">
          <AvatarImage src={other?.avatar_url ?? undefined} alt="" />
          <AvatarFallback>{(other?.username ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-semibold">{other?.display_name ?? other?.username ?? "User"}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-2 rounded-full", online ? "bg-emerald-500" : "bg-muted-foreground/40")} />
            {typing ? "typing…" : online ? "Online" : "Offline"}
          </p>
        </div>
        {conversation.listing && (
          <Link
            to="/product/$id"
            params={{ id: conversation.listing.id }}
            className="ml-auto truncate rounded-full border px-3 py-1.5 text-xs font-medium hover:border-primary"
          >
            {conversation.listing.title}
          </Link>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm",
                  mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                {m.kind === "image" && m.attachment_url && (
                  <img src={m.attachment_url} alt="" className="mb-1 max-h-64 rounded-xl object-cover" />
                )}
                {m.kind === "voice" && m.attachment_url && (
                  <audio controls src={m.attachment_url} className="w-56" />
                )}
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                <p className={cn("mt-1 text-[11px]", mine ? "text-primary-foreground/75" : "text-muted-foreground")}>
                  {timeAgo(m.created_at)}
                  {mine && (m.read_at ? " · Read" : " · Sent")}
                </p>
              </div>
            </div>
          );
        })}
        {typing && <p className="text-xs text-muted-foreground">typing…</p>}
        <div ref={bottom} />
      </div>

      <form
        className="flex items-center gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          void send({ body: text.trim() });
          setText("");
        }}
      >
        <label className="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-muted" aria-label="Send a photo">
          <ImagePlus className="size-5" />
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
              void sendImage(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="rounded-full" aria-label="Emoji">
              <Smile className="size-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="grid grid-cols-8 gap-1 text-xl">
              {EMOJI.map((e) => (
                <button key={e} type="button" className="rounded hover:bg-muted" onClick={() => setText((t) => t + e)}>
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant={recording ? "destructive" : "ghost"}
          size="icon"
          className="rounded-full"
          aria-label={recording ? "Stop recording" : "Record a voice note"}
          onClick={() => void toggleRecording()}
        >
          {recording ? <Square className="size-4" /> : <Mic className="size-5" />}
        </Button>

        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            notifyTyping();
          }}
          placeholder={recording ? "Recording…" : "Write a message"}
          className="h-10 flex-1 rounded-full"
          aria-label="Message"
        />
        <Button type="submit" size="icon" className="rounded-full" aria-label="Send">
          <Send className="size-4" />
        </Button>
      </form>
    </section>
  );
}
