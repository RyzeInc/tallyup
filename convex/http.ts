import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { parseCoachOutput } from "../lib/llm/parseOutput";
import { getCoachProvider } from "../lib/llm";
import {
  prepareCoachTurn,
  finalizeCoachTurn,
  BUDGET_EXCEEDED_MESSAGE,
  type CoachTurnArgs,
} from "./coach";

const http = httpRouter();

/**
 * Origins allowed to call the streaming endpoint. Convex HTTP actions are
 * served from *.convex.site, so browser calls from the app origin are
 * cross-origin and need explicit CORS.
 */
function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;

  const configured = (process.env.ALLOWED_WEB_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (configured.includes(origin)) return origin;
  // Local development convenience.
  if (/^http:\/\/localhost:\d+$/.test(origin)) return origin;
  return null;
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = allowedOrigin(request);
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** One SSE frame. */
function frame(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  );
}

http.route({
  path: "/coach/stream",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

/**
 * Streaming coach turn.
 *
 * Emits `delta` frames as tokens arrive, then a final `done` frame carrying the
 * same structured payload the non-streaming `coach.chat` action returns. Both
 * paths share prepareCoachTurn/finalizeCoachTurn, so context building, budget
 * accounting, anti-loop guards, and memory writes cannot drift apart.
 */
http.route({
  path: "/coach/stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const cors = corsHeaders(request);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }
    const userId = identity.subject;

    let body: CoachTurnArgs;
    try {
      body = (await request.json()) as CoachTurnArgs;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    if (typeof body.message !== "string" || body.message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const prepared = await prepareCoachTurn(ctx, userId, body);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (prepared.budgetExceeded) {
            controller.enqueue(frame("delta", { text: BUDGET_EXCEEDED_MESSAGE }));
            controller.enqueue(
              frame("done", {
                assistantMessage: BUDGET_EXCEEDED_MESSAGE,
                actions: [],
                followUps: [],
                contextHash: prepared.contextHash,
              })
            );
            return;
          }

          const providerInput = {
            message: body.message,
            contextPacket: prepared.packetWithKnowledge,
            systemPrompt: prepared.systemPrompt,
          };

          let raw = "";
          let output;

          try {
            if (prepared.provider.generateStream) {
              for await (const delta of prepared.provider.generateStream(providerInput)) {
                raw += delta;
                controller.enqueue(frame("delta", { text: delta }));
              }
              output = parseCoachOutput(raw);
            } else {
              // Provider has no streaming endpoint: fall back to one shot and
              // emit it as a single delta so the client path stays uniform.
              output = await prepared.provider.generate(providerInput);
              controller.enqueue(frame("delta", { text: output.assistantMessage }));
            }
          } catch (err) {
            console.error("[coach/stream] provider error:", err);
            const fallback = getCoachProvider({ forceMock: true });
            output = await fallback.provider.generate(providerInput);
            controller.enqueue(
              frame("delta", { text: output.assistantMessage, replacesStream: true })
            );
          }

          const result = await finalizeCoachTurn(
            ctx,
            userId,
            body.message,
            prepared,
            output
          );
          controller.enqueue(frame("done", result));
        } catch (err) {
          console.error("[coach/stream] fatal error:", err);
          controller.enqueue(
            frame("error", { message: "The coach couldn't finish that response." })
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        ...cors,
      },
    });
  }),
});

export default http;
