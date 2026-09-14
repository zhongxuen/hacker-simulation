import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowRightIcon, BookOpenIcon, TerminalIcon } from "@/components/ui/icons";
import { ButtonLink } from "@/components/ui/button";
import { GLOSSARY } from "@/content/glossary";
import { LESSON_LEVEL_LABELS, LESSON_TOPIC_IDS, LESSON_TOPICS } from "@/content/topics";
import { START_HERE } from "@/content/tracks";
import { getLesson, listLessons } from "@/features/learning/server";
import { getAppSection } from "@/lib/app-sections";
import { FIRST_STEP } from "@/lib/next-step";

export const metadata: Metadata = { title: getAppSection("learn").label };

export default function LearnPage() {
  const lessons = listLessons();
  const track = START_HERE.lessons.flatMap((id) => {
    const lesson = getLesson(id);
    return lesson ? [lesson] : [];
  });
  const topics = LESSON_TOPIC_IDS.map((id) => ({
    ...LESSON_TOPICS[id],
    lessons: lessons.filter((lesson) => lesson.topic === id),
  })).filter((topic) => topic.lessons.length > 0);

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Every idea, in plain words
      </h1>
      <p className="mt-4 text-lg leading-8 text-secondary">
        Short guides that explain one idea at a time, like how passwords are stored or how computers
        find each other on a network. Start at the beginning, or look up a word whenever a mission
        uses one you don&apos;t know.
      </p>

      {track.length > 0 && (
        <section aria-labelledby="start-here-track" className="mt-10">
          <h2 id="start-here-track" className="text-2xl font-semibold tracking-tight">
            {START_HERE.title}
          </h2>
          <p className="mt-1 leading-7 text-secondary">{START_HERE.description}</p>
          <ol className="mt-4 space-y-3">
            {track.map((lesson, index) => (
              <li key={lesson.id}>
                <Card href={`/learn/${lesson.id}`} className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-subtle font-mono text-sm font-semibold text-accent"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold">{lesson.title}</span>
                    {(lesson.summary ?? lesson.analogy) !== undefined && (
                      <span className="mt-1 block leading-7 text-secondary">
                        {lesson.summary ?? lesson.analogy}
                      </span>
                    )}
                    <span className="mt-2 block text-sm text-secondary">
                      About {lesson.readingMinutes} min
                    </span>
                  </span>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Card href="/learn/glossary" className="mt-10 flex items-start gap-4">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-overlay text-accent [&_svg]:size-5"
        >
          <BookOpenIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold">Glossary</span>
          <span className="mt-1 block leading-7 text-secondary">
            {GLOSSARY.length} words from security, networking and Linux, each explained in one plain
            sentence.
          </span>
        </span>
        <ArrowRightIcon aria-hidden="true" className="mt-1 size-5 shrink-0 text-accent" />
      </Card>

      <Card href="/learn/commands" className="mt-3 flex items-start gap-4">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-overlay text-accent [&_svg]:size-5"
        >
          <TerminalIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold">Command manual</span>
          <span className="mt-1 block leading-7 text-secondary">
            Every command the terminal knows, with the same manual page{" "}
            <code className="font-mono text-primary">man</code> shows.
          </span>
        </span>
        <ArrowRightIcon aria-hidden="true" className="mt-1 size-5 shrink-0 text-accent" />
      </Card>

      {topics.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={<BookOpenIcon />}
          title="The first lessons are on their way"
          description="They'll start from zero: what ethical hacking is, what a terminal is, and how networks work. Meanwhile, your first mission teaches as you go."
          action={
            <ButtonLink href={FIRST_STEP.href} variant="primary">
              Start your first mission
            </ButtonLink>
          }
        />
      ) : (
        <div className="mt-12 space-y-12">
          {topics.map((topic) => (
            <section key={topic.id} aria-labelledby={`topic-${topic.id}`}>
              <h2 id={`topic-${topic.id}`} className="text-2xl font-semibold tracking-tight">
                {topic.label}
              </h2>
              <p className="mt-1 leading-7 text-secondary">{topic.description}</p>
              <ul className="mt-4 space-y-3">
                {topic.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Card href={`/learn/${lesson.id}`}>
                      <span className="block text-lg font-semibold">{lesson.title}</span>
                      {(lesson.summary ?? lesson.analogy) !== undefined && (
                        <span className="mt-1 block leading-7 text-secondary">
                          {lesson.summary ?? lesson.analogy}
                        </span>
                      )}
                      <span className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge>{LESSON_LEVEL_LABELS[lesson.level]}</Badge>
                        <span className="text-sm text-secondary">
                          About {lesson.readingMinutes} min
                        </span>
                      </span>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
