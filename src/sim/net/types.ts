/**
 * The simulated network. Two separate structures, on purpose:
 *
 * - `NetworkGraph` is ground truth: every host, service and firewall rule in the scenario.
 * - `DiscoveryState` is what the learner has actually observed with their tools.
 *
 * The network visualizer (phase 07) renders only discovery state, which is what turns scanning
 * into a fog-of-war map.
 */
import type { FsSpec, GroupSpec, UserSpec } from "../fs/types";

export type Protocol = "tcp" | "udp";

export type OsFamily = "linux" | "windows" | "bsd" | "macos" | "embedded" | "other";

export interface OsProfile {
  readonly family: OsFamily;
  /** What a fingerprint would show, like "Linux" or "Embedded printer firmware". */
  readonly name: string;
  readonly version?: string;
}

export interface HttpPage {
  readonly status: number;
  readonly title?: string;
  /** Page source. HTML comments in it are shown by webprobe, like notes left in view-source. */
  readonly body?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** How a web service answers, for webprobe. */
export interface HttpProfile {
  /** Headers on every response, like "X-Powered-By". The Server header comes from product/version. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Pages by path ("/", "/admin"). Anything else is a 404. */
  readonly pages: Readonly<Record<string, HttpPage>>;
}

export interface Service {
  readonly port: number;
  readonly protocol: Protocol;
  /** The common name for what runs here: "ssh", "http", "https", "sql", "printer". */
  readonly name: string;
  /** Fictional or generic product name, like "httpd". Never a byte-copy of a real banner. */
  readonly product: string;
  readonly version: string;
  /** A greeting line some services send first. */
  readonly banner?: string;
  /**
   * Optional per-port firewall rule; same grammar as `Host.reachableFrom`. When set, it replaces
   * the host's rule for this port ("the database only accepts the web server").
   */
  readonly reachableFrom?: readonly string[];
  readonly http?: HttpProfile;
}

export interface NetworkInterface {
  readonly ip: string;
  /** The subnet this address belongs to, in CIDR form: "10.0.1.0/24". */
  readonly subnet: string;
}

export interface Host {
  readonly id: string;
  readonly hostname: string;
  readonly interfaces: readonly NetworkInterface[];
  readonly os: OsProfile;
  /** Sorted by port, then protocol. */
  readonly services: readonly Service[];
  /**
   * Who can reach this host: "*" (anyone), a host id ("web-01"), or a subnet ("10.0.1.0/24").
   * Reachability is explicit data, not a physics simulation, which is what makes firewalls and
   * segmentation teachable: a scenario states the rule and the engine enforces it.
   */
  readonly reachableFrom: readonly string[];
  /** Hosts that ignore "are you there?" pings only show up in scans that skip the ping. */
  readonly respondsToPing: boolean;
}

export interface Subnet {
  readonly cidr: string;
  readonly name?: string;
}

export interface NetworkGraph {
  /** Sorted by address. */
  readonly subnets: readonly Subnet[];
  readonly hosts: Readonly<Record<string, Host>>;
}

// ---------------------------------------------------------------------------------------------
// What the learner has observed
// ---------------------------------------------------------------------------------------------

export interface DiscoveredService {
  readonly port: number;
  readonly protocol: Protocol;
  /** The service name as the tool guessed it. */
  readonly name: string;
  /** Known only after fingerprinting (webprobe). */
  readonly product?: string;
  readonly version?: string;
  readonly banner?: string;
  /** The command number that first revealed it. */
  readonly firstSeenTick: number;
  /** The tool that first revealed it. */
  readonly via: string;
}

export interface DiscoveredHost {
  readonly hostId: string;
  /** Addresses the learner has seen this host answer on, sorted. */
  readonly ips: readonly string[];
  readonly hostname?: string;
  readonly osGuess?: string;
  readonly firstSeenTick: number;
  readonly via: string;
  /** A port scan has run against it: "detected" vs "enumerated" on the map. */
  readonly portScanned: boolean;
  /** The learner has a session on it: the "accessed" state on the map. */
  readonly accessed: boolean;
  /** Keyed "port/protocol", like "22/tcp". */
  readonly services: Readonly<Record<string, DiscoveredService>>;
}

export interface DiscoveryState {
  readonly hosts: Readonly<Record<string, DiscoveredHost>>;
}

// ---------------------------------------------------------------------------------------------
// Declarative specs, written in mission content and turned into a NetworkGraph by net/build.ts
// ---------------------------------------------------------------------------------------------

export interface HostSpec {
  readonly id: string;
  /** Fictional: a single label ("web-01") or a reserved domain ("web-01.corp.example"). */
  readonly hostname: string;
  /** Addresses must be in reserved ranges (10.x, 172.16-31.x, 192.168.x, documentation ranges). */
  readonly interfaces: readonly NetworkInterface[];
  readonly os: OsProfile;
  readonly services?: readonly Service[];
  /** Defaults to the host's own subnets: machines on the same network can reach each other. */
  readonly reachableFrom?: readonly string[];
  /** Defaults to true. */
  readonly respondsToPing?: boolean;
  /** Give a host a filesystem to make it a machine the learner can have a shell on. */
  readonly fs?: FsSpec;
  readonly users?: readonly UserSpec[];
  readonly groups?: readonly GroupSpec[];
}

export interface NetworkSpec {
  /** Names for subnets. Subnets used by interfaces but not listed here are added unnamed. */
  readonly subnets?: readonly Subnet[];
  readonly hosts: readonly HostSpec[];
}
