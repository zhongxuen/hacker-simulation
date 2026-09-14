import { getAnthropicRunner, handleHintRequest, readMentorConfig } from "@/features/mentor/server";
import { getMissionById } from "@/features/missions/server";

/**
 * POST /api/mentor/hint — the AI Mentor's hint proxy (md-files/10-ai-mentor.md, prompts 10.1, 10.2).
 *
 * Server-only and stateless: no module-level state remembers a request or a learner. Each call is
 * validated fresh, the authored hint is loaded from the mission content (never from the request),
 * and the response streams newline-delimited JSON (`text` / `done` / `fallback`). If anything goes
 * wrong — no API key, the kill switch, a bad or oversized body, an unknown target, a model failure,
 * or a rejected response — the client is told to fall back to the authored hint. Nothing surfaces to
 * the learner as an error.
 *
 * Rate limiting is enforced at the edge by a Vercel Firewall rate-limit rule on /api/mentor/* (see
 * md-files/deployment.md). A request over the limit is stopped there (429/403) and the client treats
 * that exactly like any other fallback, so an over-limit learner still gets the authored hint.
 *
 * The mission YAML is read at runtime by getMissionById, so next.config.ts traces the mission files
 * into this function's bundle (outputFileTracingIncludes).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const config = readMentorConfig();
  const runner = config.apiKey && !config.disabled ? getAnthropicRunner(config.apiKey) : undefined;

  return handleHintRequest(request, {
    config,
    getMission: getMissionById,
    ...(runner ? { runner } : {}),
  });
}
