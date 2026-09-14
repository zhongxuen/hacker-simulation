import {
  getAnthropicRunner,
  handleExplainRequest,
  readMentorConfig,
} from "@/features/mentor/server";
import { getMissionById } from "@/features/missions/server";

/**
 * POST /api/mentor/explain — "Explain this" (md-files/10-ai-mentor.md, prompt 10.3): Noor explains a
 * terminal line, an error, a command's result, or a glossary word, in the context of the mission.
 *
 * Stateless and streaming, exactly like /api/mentor/hint: validated fresh, capped, delimited, output
 * checked before release, one metadata-only log line, and every problem (no key, the kill switch, a
 * bad body, a model failure, a rejected answer, the Vercel Firewall rate limit on /api/mentor/*)
 * becomes a fallback: the client shows the explanation written ahead of time.
 *
 * next.config.ts traces the mission files into this function's bundle, as for the hint route.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const config = readMentorConfig();
  const runner = config.apiKey && !config.disabled ? getAnthropicRunner(config.apiKey) : undefined;

  return handleExplainRequest(request, {
    config,
    getMission: getMissionById,
    ...(runner ? { runner } : {}),
  });
}
