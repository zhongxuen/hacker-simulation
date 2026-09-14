import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CharacterMessage } from "@/components/ui/character-message";
import { ArrowRightIcon, PlayIcon, SparkleIcon } from "@/components/ui/icons";
import { startHereMissionId } from "@/content/campaigns";
import { getCastMember } from "@/content/cast";
import type { Campaign, CampaignLine } from "@/content/schemas/campaign";
import { SKILL_IDS, SKILLS } from "@/content/skills";
import type { MissionSummary } from "./mission-summary";
import { DIFFICULTY_LABELS, MissionText } from "./mission-text";
import { SkillBadge, SkillIconGlyph } from "./skill-badge";

interface CampaignMapProps {
  campaign: Campaign;
  /** Card data for every mission the campaign names (answers and scenarios stay out). */
  missions: readonly MissionSummary[];
}

function Line({ line }: { line: CampaignLine }) {
  const member = getCastMember(line.speaker);
  return (
    <CharacterMessage
      speaker={
        member
          ? { name: member.name, role: member.role, initials: member.initials }
          : { name: line.speaker }
      }
      tone={member?.tone ?? "teammate"}
    >
      <MissionText text={line.text} />
    </CharacterMessage>
  );
}

/**
 * The campaign map (md-files/08-campaign-and-story.md, prompt 08.2): each chapter as a section with
 * its story framing voiced by the cast, then its missions in the recommended order, as a path of
 * episodes. Built entirely from the campaign data: no chapter is written here.
 *
 * Every mission is open. There are no locked or completed states, because nothing is recorded
 * (md-files/03-app-state-and-privacy.md): the order is a suggestion, and the first mission is
 * marked "Start here". Each episode is one link, so the keyboard reaches them in story order.
 */
export function CampaignMap({ campaign, missions }: CampaignMapProps) {
  const byId = new Map(missions.map((mission) => [mission.id, mission]));
  const startId = startHereMissionId(campaign);
  const start = byId.get(startId);
  const skillsUsed = SKILL_IDS.filter((skill) =>
    missions.some((mission) => mission.skills.includes(skill)),
  );

  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold text-accent">Campaign</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {campaign.title}
      </h1>
      <p className="mt-4 text-lg leading-8 text-secondary">{campaign.description}</p>

      {start && (
        <section
          aria-labelledby="campaign-start-here"
          className="mt-8 rounded-xl border border-accent bg-accent-subtle p-5 sm:p-6"
        >
          <h2 id="campaign-start-here" className="text-sm font-semibold tracking-wide text-accent">
            Not sure where to begin? Start here.
          </h2>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{start.title}</p>
          <p className="mt-1 leading-7 text-primary">
            <MissionText text={start.hook} />
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ButtonLink
              href={`/missions/${start.slug}`}
              variant="primary"
              size="lg"
              icon={<PlayIcon />}
            >
              Start your first mission
            </ButtonLink>
            <span className="text-sm text-secondary">About {start.estimatedMinutes} minutes</span>
          </div>
        </section>
      )}

      <p className="mt-6 leading-7 text-secondary">
        Every mission is open, so you can play them in any order. This is the order the story tells
        them in. Nothing you do is saved, so each one is ready whenever you are.
      </p>

      <div className="mt-10 space-y-14">
        {campaign.chapters.map((chapter, chapterIndex) => {
          const headingId = `chapter-${chapter.id}`;
          return (
            <section key={chapter.id} aria-labelledby={headingId}>
              <p className="text-sm font-semibold tracking-wide text-secondary">
                Chapter {chapterIndex + 1}
              </p>
              <h2 id={headingId} className="mt-1 text-2xl font-semibold tracking-tight">
                {chapter.title}
              </h2>
              <p className="mt-2 leading-7 text-secondary">
                <MissionText text={chapter.narrative} />
              </p>
              <div className="mt-5 space-y-4">
                {chapter.lines.map((line, index) => (
                  <Line key={index} line={line} />
                ))}
              </div>

              <ol aria-label={`Chapter ${chapterIndex + 1} missions`} className="mt-8 space-y-4">
                {chapter.missions.map((missionId, index) => {
                  const mission = byId.get(missionId);
                  if (!mission) return null;
                  const last = index === chapter.missions.length - 1;
                  return (
                    <li key={missionId} className="relative grid grid-cols-[2.5rem_1fr] gap-4">
                      {/* The path between episodes. Decorative: the list order says the same. */}
                      {!last && (
                        <span
                          aria-hidden="true"
                          className="absolute top-12 bottom-[-1rem] left-5 w-px -translate-x-1/2 bg-(--border-strong)"
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className="relative z-10 mt-4 grid size-10 place-items-center rounded-full border-2 border-accent bg-surface-base font-mono text-sm font-semibold text-accent"
                      >
                        {index + 1}
                      </span>
                      <Card href={`/missions/${mission.slug}`} className="flex items-start gap-4">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-secondary">
                            Episode {index + 1} · {DIFFICULTY_LABELS[mission.difficulty]} · About{" "}
                            {mission.estimatedMinutes} min
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-lg font-semibold">{mission.title}</span>
                            {mission.id === startId && (
                              <Badge tone="accent" appearance="solid">
                                Start here
                              </Badge>
                            )}
                          </span>
                          <span className="mt-1 block leading-7 text-secondary">
                            <MissionText text={mission.hook} />
                          </span>
                          <span className="mt-3 flex flex-wrap items-center gap-2">
                            {mission.skills.map((skill) => (
                              <SkillBadge key={skill} skill={skill} />
                            ))}
                          </span>
                          {mission.bestAfter.length > 0 && (
                            <span className="mt-2 block text-sm text-muted">
                              Best after: {mission.bestAfter.join(", ")}
                            </span>
                          )}
                        </span>
                        <ArrowRightIcon
                          aria-hidden="true"
                          className="mt-1 size-5 shrink-0 text-accent"
                        />
                      </Card>
                    </li>
                  );
                })}
              </ol>

              {chapter.closing && (
                <div className="mt-8">
                  <Line line={chapter.closing} />
                </div>
              )}
            </section>
          );
        })}
      </div>

      {campaign.upNext && (
        <section
          aria-labelledby="campaign-up-next"
          className="mt-14 rounded-xl border border-reward bg-surface-raised p-5"
        >
          <h2
            id="campaign-up-next"
            className="flex items-center gap-2 text-lg font-semibold text-reward"
          >
            <SparkleIcon className="size-5" />
            What&apos;s next
          </h2>
          <p className="mt-2 leading-7 text-secondary">{campaign.upNext}</p>
        </section>
      )}

      {skillsUsed.length > 0 && (
        <section aria-labelledby="campaign-skills" className="mt-14">
          <h2 id="campaign-skills" className="text-lg font-semibold">
            The skills you&apos;ll practise
          </h2>
          <ul className="mt-3 space-y-3">
            {skillsUsed.map((skill) => (
              <li key={skill} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-subtle text-accent"
                >
                  <SkillIconGlyph skill={skill} className="size-4.5" />
                </span>
                <span className="leading-7">
                  <span className="font-semibold text-primary">{SKILLS[skill].label}:</span>{" "}
                  <span className="text-secondary">{SKILLS[skill].description}.</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
