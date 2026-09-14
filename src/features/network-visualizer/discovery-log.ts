/**
 * Which command revealed what (md-files/07-network-visualizer.md, prompt 07.3), read from the
 * engine's event stream. The inspector shows it: "Found by `netscan 10.40.1.0/24`".
 *
 * Every tool run sends its discovery events (`host.discovered`, `service.discovered`) and then its
 * own `command.run`, which carries the command as typed for that tool. So each discovery belongs
 * to the next `command.run` after it. Pure, and it reads events only: never the engine's state.
 */
import type { Protocol, SimEvent } from "@/sim/types";

export interface Revealed {
  /** The tool's command line: `netscan 10.40.1.0/24`. */
  readonly line: string;
  /** The tool's name: `netscan`. */
  readonly command: string;
}

export interface DiscoveryLog {
  /** By host id. */
  readonly hosts: ReadonlyMap<string, Revealed>;
  /** By `serviceLogKey(hostId, port, protocol)`. */
  readonly services: ReadonlyMap<string, Revealed>;
}

export const serviceLogKey = (hostId: string, port: number, protocol: Protocol): string =>
  `${hostId}:${port}/${protocol}`;

export const EMPTY_DISCOVERY_LOG: DiscoveryLog = { hosts: new Map(), services: new Map() };

/**
 * The command that revealed each host and service in `events` (every event since the run began,
 * oldest first). After Reset machine the map starts over and the same things are discovered again,
 * so the latest discovery of each wins: it's the one the map is showing.
 */
export function discoveryLog(events: readonly SimEvent[]): DiscoveryLog {
  const hosts = new Map<string, Revealed>();
  const services = new Map<string, Revealed>();
  let pendingHosts: string[] = [];
  let pendingServices: string[] = [];
  for (const event of events) {
    if (event.type === "host.discovered") pendingHosts.push(event.hostId);
    else if (event.type === "service.discovered") {
      pendingServices.push(serviceLogKey(event.hostId, event.port, event.protocol));
    } else if (event.type === "command.run") {
      const revealed = { line: event.line, command: event.command };
      for (const id of pendingHosts) hosts.set(id, revealed);
      for (const key of pendingServices) services.set(key, revealed);
      pendingHosts = [];
      pendingServices = [];
    }
  }
  return { hosts, services };
}
