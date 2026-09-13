/**
 * The mission feature's server-only API: loading missions from src/content/missions. It reads
 * files with Node's fs, so import it only from server components, route handlers, build-time
 * functions like generateStaticParams, and tests. Client code uses `@/features/missions`.
 */
export {
  buildMissionCatalog,
  getMission,
  getMissionById,
  getMissionCatalog,
  getMissionGraph,
  listMissions,
  loadMissionCatalog,
  MISSIONS_DIR,
  type MissionCatalog,
  type MissionFile,
  type MissionFilter,
} from "./loader/catalog";
export { MISSION_FILE_EXTENSION, MissionSourceError, parseMissionSource } from "./loader/source";
