import type { ComponentType } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  FootprintsIcon,
  GlobeIcon,
  KeyIcon,
  NetworkIcon,
  ShieldIcon,
  TerminalIcon,
  type IconProps,
} from "@/components/ui/icons";
import { SKILLS, type Skill, type SkillIcon } from "@/content/skills";

/** The drawing for each skill icon named in src/content/skills.ts. */
export const SKILL_ICONS: Readonly<Record<SkillIcon, ComponentType<IconProps>>> = {
  terminal: TerminalIcon,
  network: NetworkIcon,
  globe: GlobeIcon,
  key: KeyIcon,
  footprints: FootprintsIcon,
  shield: ShieldIcon,
};

/** A skill's icon, drawn in the current text colour. Decorative: always next to its name. */
export function SkillIconGlyph({ skill, className }: { skill: Skill; className?: string }) {
  const Glyph = SKILL_ICONS[SKILLS[skill].icon];
  return <Glyph className={className} />;
}

/** A skill as a badge: its icon and its display name, from the fixed skill taxonomy. */
export function SkillBadge({ skill, tone = "accent" }: { skill: Skill; tone?: BadgeTone }) {
  return (
    <Badge tone={tone} icon={<SkillIconGlyph skill={skill} />}>
      {SKILLS[skill].label}
    </Badge>
  );
}
