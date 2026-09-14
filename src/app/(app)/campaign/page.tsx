import type { Metadata } from "next";
import { campaignMissionIds, MAIN_CAMPAIGN } from "@/content/campaigns";
import { CampaignMap, summarizeMission } from "@/features/missions";
import { getMissionById, listMissions } from "@/features/missions/server";
import { getAppSection } from "@/lib/app-sections";

export const metadata: Metadata = { title: getAppSection("campaign").label };

/**
 * The campaign map: the story's chapters and their missions, read from the campaign data and the
 * mission files at build time. Every mission is open; the order is a recommendation.
 */
export default function CampaignPage() {
  const titles = new Map(listMissions().map((mission) => [mission.id, mission.title]));
  const missions = campaignMissionIds(MAIN_CAMPAIGN).flatMap((id) => {
    const mission = getMissionById(id);
    return mission ? [summarizeMission(mission, titles)] : [];
  });

  return <CampaignMap campaign={MAIN_CAMPAIGN} missions={missions} />;
}
