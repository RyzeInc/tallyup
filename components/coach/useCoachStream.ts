"use client";

import { useCallback, useRef, useState } from "react";
import { useAction } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

/**
 * Mirrors the non-streaming action's return type exactly, so callers can swap
 * between the two paths without any shape differences.
 */
export type CoachTurnResult = FunctionReturnType<typeof api.coach.chat>;

export type SendOptions = {
  clientContextHash?: string;
  conversationMode?: string;
};

/**
 * Convex HTTP actions are served from the `.convex.site` sibling of the
 * `.convex.cloud` deployment URL.
 */
function streamEndpoint(): string | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return `${url.replace(/\.convex\.cloud$/, ".convex.site")}/coach/stream`;
}

/**
 * Sends a coach turn and surfaces tokens as they arrive.
 *
 * Falls back to the non-streaming `coach.chat` action if the streaming
 * endpoint is unreachable, so the coach keeps working regardless.
 */
export function useCoachStream() {
  const chatAction = useAction(api.coach.chat);
  const { getToken } = useAuth();

  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const send = useCallback(
    async (message: string, options?: SendOptions): Promise<CoachTurnResult> => {
      const endpoint = streamEndpoint();
      setStreamingText("");
      setIsStreaming(true);

      const finishWithAction = async (): Promise<CoachTurnResult> => {
        const result = (await chatAction({
          message,
          clientContextHash: options?.clientContextHash,
          conversationMode: options?.conversationMode as never,
        })) as CoachTurnResult;
        setStreamingText("");
        setIsStreaming(false);
        return result;
      };

      if (!endpoint) return finishWithAction();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const token = await getToken({ template: "convex" });
        const response = await fetch(endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message,
            clientContextHash: options?.clientContextHash,
            conversationMode: options?.conversationMode,
          }),
        });

        if (!response.ok || !response.body) {
          // Streaming unavailable (misconfigured CORS, cold deploy, etc.)
          return finishWithAction();
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";
        let final: CoachTurnResult | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const raw of events) {
            let eventName = "message";
            let dataLine = "";
            for (const line of raw.split("\n")) {
              if (line.startsWith("event:")) eventName = line.slice(6).trim();
              else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
            }
            if (!dataLine) continue;

            let payload: Record<string, unknown>;
            try {
              payload = JSON.parse(dataLine);
            } catch {
              continue;
            }

            if (eventName === "delta") {
              const text = typeof payload.text === "string" ? payload.text : "";
              // The server sends `replacesStream` when it had to abandon a
              // partial stream and fall back to a whole response.
              accumulated = payload.replacesStream ? text : accumulated + text;
              setStreamingText(accumulated);
            } else if (eventName === "done") {
              final = payload as unknown as CoachTurnResult;
            } else if (eventName === "error") {
              throw new Error(String(payload.message ?? "Coach stream failed"));
            }
          }
        }

        if (!final) return finishWithAction();

        setStreamingText("");
        setIsStreaming(false);
        abortRef.current = null;
        return final;
      } catch (err) {
        abortRef.current = null;
        if (err instanceof DOMException && err.name === "AbortError") {
          setIsStreaming(false);
          setStreamingText("");
          throw err;
        }
        console.warn("[coach] streaming failed, falling back to action:", err);
        return finishWithAction();
      }
    },
    [chatAction, getToken]
  );

  return { send, cancel, streamingText, isStreaming };
}
