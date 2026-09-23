"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@rms/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@rms/ui/card";
import { Input } from "@rms/ui/input";
import { apiClient } from "@rms/api-client/client";
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context";
import { BotIcon, SendIcon, Trash2Icon, UserIcon } from "lucide-react";
import { AssistantMessage } from "../assistant-message";

type ChatResult = { route: string; answer: string };
type ChatMessage = { id: number; role: "user" | "assistant"; text: string; route?: string };

const starterQuestions = [
	"How many bookings did we get today?",
	"What was our revenue this week?",
	"Any cancellations or service issues today?",
];

export function AssistantPanel() {
	const { outletId } = useActiveOutlet();
	const [question, setQuestion] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [message, setMessage] = useState("");
	const [busy, setBusy] = useState(false);
	const endOfMessages = useRef<HTMLDivElement>(null);

	useEffect(() => {
		endOfMessages.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
	}, [messages, busy]);

	async function ask(value = question) {
		const trimmed = value.trim();
		if (!trimmed || busy) return;
		setBusy(true);
		setMessage("");
		setQuestion("");
		setMessages((current) => [...current, { id: Date.now(), role: "user", text: trimmed }]);
		try {
			const result = await apiClient<ChatResult>("/assistant/chat", {
				method: "POST",
				body: JSON.stringify({ question: trimmed, outletId: outletId ?? undefined }),
			});
			setMessages((current) => [...current, { id: Date.now() + 1, role: "assistant", text: result.answer, route: result.route }]);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Unable to answer");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold">Restra AI</h1>
				<p className="text-sm text-muted-foreground">Your playful AI sidekick for restaurant operations.</p>
			</div>
			<Card className="bg-card bg-none">
				<CardHeader>
					<div className="flex items-center justify-between gap-3">
						<div>
							<CardTitle>Ask a question</CardTitle>
							<CardDescription>{outletId ? `Using outlet #${outletId}` : "Using all accessible outlets"}</CardDescription>
						</div>
						{messages.length > 0 && <Button variant="ghost" size="sm" onClick={() => { setMessages([]); setMessage(""); }}><Trash2Icon /> Clear</Button>}
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					{messages.length === 0 && <div className="flex flex-wrap gap-2">
						{starterQuestions.map((starter) => <Button key={starter} variant="outline" size="sm" onClick={() => void ask(starter)} disabled={busy}>{starter}</Button>)}
					</div>}
					{messages.length > 0 && <div className="max-h-[440px] space-y-4 overflow-y-auto rounded-lg border p-4">
						{messages.map((item) => <div key={item.id} className={`flex gap-3 ${item.role === "user" ? "justify-end" : "justify-start"}`}>
							<div className={`flex max-w-[85%] gap-2 rounded-lg p-3 text-sm ${item.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
								{item.role === "assistant" ? <BotIcon className="mt-0.5 size-4 shrink-0" /> : <UserIcon className="mt-0.5 size-4 shrink-0" />}
								<div className="whitespace-pre-wrap">{item.route && <div className="mb-1 text-[10px] font-medium uppercase opacity-60">{item.route}</div>}<AssistantMessage text={item.text} /></div>
							</div>
						</div>)}
						{busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><BotIcon className="size-4" /> Thinking…</div>}
						<div ref={endOfMessages} />
					</div>}
					<div className="flex gap-2">
						<Input
							value={question}
							onChange={(event) => setQuestion(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(); }
							}}
							placeholder="Ask Restra AI about your restaurant…"
							aria-label="Assistant question"
						/>
						<Button onClick={() => void ask()} disabled={busy || !question.trim()} aria-label="Send question">
							<SendIcon />
					</Button>
					</div>
				</CardContent>
			</Card>
			{message && <p className="text-sm text-destructive">{message}</p>}
		</div>
	);
}
