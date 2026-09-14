import {
  HintBubbleDemo,
  NudgeChipDemo,
  NudgeChipPicture,
  ReviewCardDemo,
  TypingIndicatorDemo,
} from "./mentor-demos";
import { motionVariants, Specimen } from "./specimen";
import { Code, Section } from "./styleguide-ui";

const DISPLAY_ONLY_REASON = "Display only: nothing to point at, focus, or press.";

/**
 * The mentor's pieces (md-files/10-ai-mentor.md, prompts 10.3 and 10.4): how Noor's replies look
 * while she writes, in her own words, and from her notes; the nudge chip; and the post-mission
 * review. The panel itself (src/features/mentor/components/mentor-panel.tsx) is a drawer over the
 * mission workspace built from these, so it's seen in a mission rather than here.
 */
export function MentorSection({ id }: { id: string }) {
  return (
    <Section
      id={id}
      title="Mentor"
      intro={
        <p>
          Noor, the mentor, gives free hints, explains what&apos;s on screen, and looks back at a
          finished run. Every reply has three states: writing (the typing indicator), her own words,
          and her notes written ahead of time, which show when the live mentor is switched off or
          busy. None of them is ever an error. The panel only opens when the learner asks.
        </p>
      }
    >
      <div className="space-y-8">
        <Specimen
          name="Typing indicator"
          source="src/features/mentor/components/typing-indicator.tsx"
          without={{
            hover: DISPLAY_ONLY_REASON,
            focus: DISPLAY_ONLY_REASON,
            disabled: DISPLAY_ONLY_REASON,
            loading: "It is the loading state.",
            error: "When the mentor can't answer, the notes written ahead of time show instead.",
          }}
          variants={motionVariants(() => (
            <TypingIndicatorDemo />
          ))}
        >
          Three dots that rise in turn while Noor writes, with the words for it. A loading
          indicator, so it loops (<Code>animate-typing-dot</Code>) until the reply lands; under
          reduced motion the dots stand still and the words still say what&apos;s happening.
        </Specimen>

        <Specimen
          name="Mentor reply"
          source="src/features/mentor/components/mentor-bubble.tsx"
          without={{
            hover: DISPLAY_ONLY_REASON,
            focus: DISPLAY_ONLY_REASON,
            disabled: DISPLAY_ONLY_REASON,
            loading: "Shown as the Writing variant.",
            error: "Shown as the From her notes variant: a fallback, never an error.",
          }}
          variants={[
            { label: "Writing", render: () => <HintBubbleDemo status="writing" /> },
            { label: "In her own words", render: () => <HintBubbleDemo status="model" /> },
            { label: "From her notes", render: () => <HintBubbleDemo status="fallback" /> },
          ]}
        >
          A hint or an explanation, as a <Code>CharacterMessage</Code> with Noor&apos;s name and
          avatar. Her words stream in sentence by sentence once each has passed the server&apos;s
          checks. A reply from her notes looks the same, with a quiet line saying it was written
          ahead of time.
        </Specimen>

        <Specimen
          name="Nudge chip"
          source="src/features/mentor/components/nudge-chip.tsx"
          without={{
            disabled: "It either shows or it doesn't: the setting on /settings turns it off.",
            loading: "Nothing loads: pressing it opens the panel.",
            error: "It only ever offers help.",
          }}
          variants={[
            {
              label: "Want a nudge?",
              render: (state) => (state === "default" ? <NudgeChipDemo /> : <NudgeChipPicture />),
            },
          ]}
        >
          Appears in the notifications corner after a few attempts that didn&apos;t work, or a few
          minutes without a new tick. It never takes focus and never opens anything by itself;
          pressing it is the learner asking. Hiding it keeps it away until their next tick.
        </Specimen>

        <Specimen
          name="Post-mission review"
          source="src/features/mentor/components/mentor-review.tsx"
          without={{
            hover: "Its button and links show their own hover states.",
            focus: "Its button and links show their own focus rings.",
            disabled: "The learner can always ask, once per attempt.",
            loading: "Shown as the Writing variant.",
            error: "Shown as the From her notes variant: the template review, never an error.",
          }}
          variants={[
            {
              label: "Waiting to be asked (live: press the button)",
              render: () => <ReviewCardDemo state="idle" />,
            },
            { label: "Writing", render: () => <ReviewCardDemo state="writing" /> },
            { label: "In her own words", render: () => <ReviewCardDemo state="model" /> },
            {
              label: "From her notes (the template)",
              render: () => <ReviewCardDemo state="fallback" />,
            },
          ]}
        >
          On the debrief, once the learner asks. It leads with something specific they did well,
          then their approach, what went smoothly, scenic routes framed as tips, and lessons to try
          next. Formative feedback, never a grade. The facts at the bottom are the same in every
          state.
        </Specimen>
      </div>
    </Section>
  );
}
