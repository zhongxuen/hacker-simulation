import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { MentorModelRunner } from "./model";

/**
 * The real model runner, backed by the official Anthropic TypeScript SDK (md-files/10-ai-mentor.md,
 * prompt 10.1). This is the ONLY module in the feature that imports the SDK, and `import "server-only"`
 * makes importing it from any client module a build error, so the API key can never reach the
 * browser bundle. The route is the only caller.
 *
 * We stream (`client.messages.stream`) so a slow response never hits an HTTP timeout, and so the
 * handler can release Noor's hint sentence by sentence as it validates.
 */
export function createAnthropicRunner(apiKey: string): MentorModelRunner {
  const client = new Anthropic({ apiKey });

  return (input, signal) => {
    const stream = client.messages.stream(
      {
        model: input.model,
        max_tokens: input.maxTokens,
        system: input.system,
        // The transcript and any learner text are inside the user message, wrapped in a delimited
        // block the system prompt names as data, never instructions.
        messages: input.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      },
      { signal },
    );

    async function* textDeltas(): AsyncGenerator<string> {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
    }

    const iterator = textDeltas();
    return {
      [Symbol.asyncIterator]: () => iterator,
      usage: async () => {
        const message = await stream.finalMessage();
        return {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        };
      },
    };
  };
}
