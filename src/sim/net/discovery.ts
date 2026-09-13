/**
 * Discovery state: what the learner has observed, kept apart from ground truth. Tools record what
 * their output revealed; nothing here ever copies a fact the learner hasn't seen. Every function
 * is pure and returns a new state plus whether anything was new (new facts become events).
 */
import { compareIps } from "./ip";
import type { DiscoveredHost, DiscoveredService, DiscoveryState, Protocol } from "./types";

export const emptyDiscovery = (): DiscoveryState => ({ hosts: {} });

export const serviceKey = (port: number, protocol: Protocol): string => `${port}/${protocol}`;

export function discoveredHost(state: DiscoveryState, hostId: string): DiscoveredHost | undefined {
  return Object.hasOwn(state.hosts, hostId) ? state.hosts[hostId] : undefined;
}

export const isDiscovered = (state: DiscoveryState, hostId: string): boolean =>
  discoveredHost(state, hostId) !== undefined;

export interface Recorded {
  readonly discovery: DiscoveryState;
  readonly isNew: boolean;
}

const withHost = (state: DiscoveryState, host: DiscoveredHost): DiscoveryState => ({
  hosts: { ...state.hosts, [host.hostId]: host },
});

/** Records that a host answered at `ip`. New the first time this host is seen at all. */
export function recordHost(
  state: DiscoveryState,
  seen: {
    readonly hostId: string;
    readonly ip: string;
    readonly hostname?: string;
    readonly via: string;
    readonly tick: number;
  },
): Recorded {
  const existing = discoveredHost(state, seen.hostId);
  if (!existing) {
    const host: DiscoveredHost = {
      hostId: seen.hostId,
      ips: [seen.ip],
      ...(seen.hostname !== undefined && { hostname: seen.hostname }),
      firstSeenTick: seen.tick,
      via: seen.via,
      portScanned: false,
      accessed: false,
      services: {},
    };
    return { discovery: withHost(state, host), isNew: true };
  }
  const ips = existing.ips.includes(seen.ip)
    ? existing.ips
    : [...existing.ips, seen.ip].sort(compareIps);
  const hostname = existing.hostname ?? seen.hostname;
  if (ips === existing.ips && hostname === existing.hostname)
    return { discovery: state, isNew: false };
  const host = { ...existing, ips, ...(hostname !== undefined && { hostname }) };
  return { discovery: withHost(state, host), isNew: false };
}

/**
 * Records a service on an already-discovered host. New the first time that port is seen; later
 * observations fill in details (product, version, banner) without replacing known ones.
 */
export function recordService(
  state: DiscoveryState,
  hostId: string,
  seen: Omit<DiscoveredService, "firstSeenTick" | "via"> & {
    readonly via: string;
    readonly tick: number;
  },
): Recorded {
  const host = discoveredHost(state, hostId);
  if (!host) throw new Error(`discovery invariant: record host "${hostId}" before its services`);
  const key = serviceKey(seen.port, seen.protocol);
  const existing = Object.hasOwn(host.services, key) ? host.services[key] : undefined;
  const merged: DiscoveredService = {
    port: seen.port,
    protocol: seen.protocol,
    name: existing?.name ?? seen.name,
    ...pick("product", existing?.product ?? seen.product),
    ...pick("version", existing?.version ?? seen.version),
    ...pick("banner", existing?.banner ?? seen.banner),
    firstSeenTick: existing?.firstSeenTick ?? seen.tick,
    via: existing?.via ?? seen.via,
  };
  if (existing && sameService(existing, merged)) return { discovery: state, isNew: false };
  const next = { ...host, services: { ...host.services, [key]: merged } };
  return { discovery: withHost(state, next), isNew: !existing };
}

/** Marks a host as port-scanned, with an OS guess if the scan produced one. */
export function markPortScanned(
  state: DiscoveryState,
  hostId: string,
  osGuess?: string,
): DiscoveryState {
  const host = discoveredHost(state, hostId);
  if (!host) throw new Error(`discovery invariant: host "${hostId}" was never discovered`);
  if (host.portScanned && (osGuess === undefined || host.osGuess === osGuess)) return state;
  return withHost(state, { ...host, portScanned: true, ...(osGuess !== undefined && { osGuess }) });
}

/** Marks a host as one the learner has a session on. */
export function markAccessed(state: DiscoveryState, hostId: string): DiscoveryState {
  const host = discoveredHost(state, hostId);
  if (!host) throw new Error(`discovery invariant: host "${hostId}" was never discovered`);
  return host.accessed ? state : withHost(state, { ...host, accessed: true });
}

const pick = <K extends string>(key: K, value: string | undefined) =>
  (value === undefined ? {} : { [key]: value }) as Partial<Record<K, string>>;

const sameService = (a: DiscoveredService, b: DiscoveredService) =>
  a.name === b.name && a.product === b.product && a.version === b.version && a.banner === b.banner;
