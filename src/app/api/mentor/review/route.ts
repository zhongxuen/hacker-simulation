import {
  getAnthropicRunner,
  handleReviewRequest,
  readMentorConfig,
} from "@/features/mentor/server";
import { getMissionById } from "@/features/missions/server";

/**
 * POST /api/mentor/review — the post-mission review (md-files/10-ai-mentor.md, prompt 10.4): Noor
 * looks back at a finished run and writes formative feedback.
 *
 * Stateless, with the same caps, delimiting, output checks and metadata-only log line as the other
 * mentor routes. It answers with JSON (`{ mode: "model", review }` or `{ mode: "fallback", reason }`)
 * rather than a stream, because every sentence is checked before any of it is shown; on a fallback
 * (or the Vercel Firewall rate limit on /api/mentor/*) the client shows the template review built
 * from the run's facts.
 *
 * next.config.ts traces the mission files into this function's bundle, as for the hint route.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const config = readMentorConfig();
  const runner = config.apiKey && !config.disabled ? getAnthropicRunner(config.apiKey) : undefined;

  return handleReviewRequest(request, {
    config,
    getMission: getMissionById,
    ...(runner ? { runner } : {}),
  });
}
