import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { findBannedWords } from "@/content/voice";
import {
  discoveryAnnouncement,
  discoveryChange,
  discoveryLog,
  filterRows,
  HostInspector,
  hostRows,
  NetworkMapPanel,
  networkRows,
  serviceLogKey,
  SIMULATED_WATERMARK,
  sortRows,
  STATE_LABEL,
  TopologyGraph,
  TopologyTable,
  topologyExport,
  topologyExportJson,
  topologyToSvg,
  type MapPalette,
} from "@/features/network-visualizer";
import { createInitialState, fixedClock, selectTopology, step } from "@/sim";
import type { DiscoveredTopology, ScenarioSpec, SimEvent, SimState } from "@/sim/types";

/**
 * The network map's inspector, live updates, table view and export (md-files/07-network-visualizer.md,
 * prompts 07.3 to 07.5), in plain Node: the pure pieces directly, and the components as HTML.
 */

const linux = { family: "linux", name: "Linux" } as const;

/** A small office: the learner on ws-01, a two-network web server, a database, and a vault the
 * learner never reaches (it's only reachable from web-01), so it must never show up anywhere. */
const SPEC: ScenarioSpec = {
  id: "map-office",
  network: {
    subnets: [
      { cidr: "10.0.1.0/24", name: "Office" },
      { cidr: "10.0.2.0/24", name: "Servers" },
    ],
    hosts: [
      {
        id: "ws-01",
        hostname: "ws-01",
        interfaces: [{ ip: "10.0.1.10", subnet: "10.0.1.0/24" }],
        os: linux,
        users: [{ name: "recruit", uid: 1000 }],
        fs: {},
      },
      {
        id: "web-01",
        hostname: "web-01",
        interfaces: [
          { ip: "10.0.1.20", subnet: "10.0.1.0/24" },
          { ip: "10.0.2.20", subnet: "10.0.2.0/24" },
        ],
        os: { family: "linux", name: "Linux", version: "6.1" },
        services: [
          {
            port: 22,
            protocol: "tcp",
            name: "ssh",
            product: "sshd",
            version: "9.6",
            banner: "SSH-2.0-sshd_9.6",
          },
          { port: 80, protocol: "tcp", name: "http", product: "httpd", version: "2.4" },
        ],
      },
      {
        id: "db-01",
        hostname: "db-01",
        interfaces: [{ ip: "10.0.2.40", subnet: "10.0.2.0/24" }],
        os: linux,
        reachableFrom: ["*"],
      },
      {
        id: "vault-01",
        hostname: "vault-01",
        interfaces: [{ ip: "10.0.2.50", subnet: "10.0.2.0/24" }],
        os: linux,
        reachableFrom: ["web-01"],
      },
    ],
  },
  session: { host: "ws-01", user: "recruit" },
};

const COMMANDS = [
  ["netscan", "10.0.1.0/24", "-p", "common"],
  ["netscan", "10.0.2.0/24"],
] as const;

/** Runs the commands, keeping the state and every event after each one. */
function play(commands: readonly (readonly string[])[] = COMMANDS) {
  let state: SimState = createInitialState(SPEC, 1);
  const events: SimEvent[] = [];
  const topologies: DiscoveredTopology[] = [selectTopology(state)];
  for (const argv of commands) {
    const result = step(state, { type: "exec", argv: [...argv] }, fixedClock(0));
    state = result.state;
    events.push(...result.events);
    topologies.push(selectTopology(state));
  }
  return { state, events, topologies, topology: selectTopology(state) };
}

const { events, topologies, topology } = play();
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

const PALETTE: MapPalette = {
  background: "#000001",
  surface: "#000002",
  card: "#000003",
  border: "#000004",
  borderStrong: "#000005",
  text: "#000006",
  textSecondary: "#000007",
  textMuted: "#000008",
  accent: "#000009",
  info: "#00000a",
  success: "#00000b",
};

describe("discoveryLog", () => {
  it("credits each host and service to the command that revealed it", () => {
    const log = discoveryLog(events);
    expect(log.hosts.get("web-01")).toEqual({
      line: "netscan 10.0.1.0/24 -p common",
      command: "netscan",
    });
    expect(log.hosts.get("db-01")?.line).toBe("netscan 10.0.2.0/24");
    expect(log.services.get(serviceLogKey("web-01", 22, "tcp"))?.line).toBe(
      "netscan 10.0.1.0/24 -p common",
    );
    expect(log.hosts.has("vault-01")).toBe(false);
  });

  it("keeps the latest discovery, as after Reset machine", () => {
    const again = [
      ...events,
      { type: "host.discovered", hostId: "db-01", ip: "10.0.2.40", via: "netscan" },
      { type: "command.run", command: "netscan", line: "netscan db-01", exitCode: 0 },
    ] satisfies SimEvent[];
    expect(discoveryLog(again).hosts.get("db-01")?.line).toBe("netscan db-01");
  });
});

describe("live announcements", () => {
  it("names each new computer and port, and nothing else", () => {
    const [start, afterOffice, afterServers] = topologies;
    const first = discoveryAnnouncement(discoveryChange(start!, afterOffice!));
    expect(first).toContain("New computer found: web-01, 10.0.1.20.");
    expect(first).toContain("2 new open ports on web-01: 22, ssh; 80, http.");
    expect(first).not.toMatch(/ws-01/);

    const second = discoveryAnnouncement(discoveryChange(afterOffice!, afterServers!));
    expect(second).toBe("New computer found: db-01, 10.0.2.40.");
    expect(discoveryAnnouncement(discoveryChange(afterServers!, afterServers!))).toBe("");
  });

  it("never mentions a host that wasn't discovered", () => {
    for (let index = 1; index < topologies.length; index += 1) {
      const said = discoveryAnnouncement(
        discoveryChange(topologies[index - 1]!, topologies[index]!),
      );
      expect(said).not.toMatch(/vault-01|10\.0\.2\.50/);
    }
  });
});

describe("the table's rows", () => {
  const rows = hostRows(topology);

  it("has one row per discovered host, with every column filled in", () => {
    expect(rows.map((row) => row.hostId)).toEqual(["ws-01", "web-01", "db-01"]);
    const web = rows.find((row) => row.hostId === "web-01")!;
    expect(web.ips).toEqual(["10.0.1.20", "10.0.2.20"]);
    expect(web.subnets.map((subnet) => subnet.name)).toEqual(["Office", "Servers"]);
    expect(web.stateLabel).toBe("Scanned");
    expect(web.servicesText).toBe("22/tcp ssh, 80/tcp http");
    expect(web.reachableFrom).toBe("Your computer (ws-01), on the same network");
    const db = rows.find((row) => row.hostId === "db-01")!;
    expect(db.reachableFrom).toBe(
      "Your computer (ws-01), through the firewall between the networks",
    );
    expect(db.servicesText).toBe("Not checked yet");
    expect(rows[0]?.reachableFrom).toBe("This is your computer");
  });

  it("sorts by any column, both ways, with ties in address order", () => {
    expect(sortRows(rows, "host", "ascending").map((row) => row.label)).toEqual([
      "db-01",
      "web-01",
      "ws-01",
    ]);
    expect(sortRows(rows, "state", "descending").map((row) => row.stateLabel)).toEqual([
      "Accessed",
      "Scanned",
      "Found",
    ]);
    expect(sortRows(rows, "ip", "descending")[0]?.hostId).toBe("db-01");
  });

  it("filters by words and by state", () => {
    expect(filterRows(rows, { text: "ssh" }).map((row) => row.hostId)).toEqual(["web-01"]);
    expect(filterRows(rows, { text: "servers" }).map((row) => row.hostId)).toEqual([
      "web-01",
      "db-01",
    ]);
    expect(filterRows(rows, { state: "detected" }).map((row) => row.hostId)).toEqual(["db-01"]);
  });

  it("lists every network with what the drawing's boxes and lines say", () => {
    expect(networkRows(topology)).toEqual([
      { cidr: "10.0.1.0/24", name: "Office", hosts: 2, yourNetwork: true, reach: "Your network" },
      {
        cidr: "10.0.2.0/24",
        name: "Servers",
        hosts: 1,
        yourNetwork: false,
        reach: "Reached from your network, through a firewall",
      },
    ]);
  });
});

describe("TopologyTable", () => {
  const table = renderToStaticMarkup(
    createElement(TopologyTable, {
      topology,
      selectedHostId: "web-01",
      onSelectHost: () => {},
      freshHostIds: new Set(["db-01"]),
    }),
  );
  const tableText = text(table);

  it("is a real table with every column from the spec, sortable", () => {
    expect(table).toContain("<table");
    for (const column of ["Host", "IP", "Subnet", "State", "OS", "Services", "Reachable from"]) {
      expect(table).toMatch(new RegExp(`<th scope="col"[^>]*>(<button[^>]*>)?${column}`));
    }
    expect(table).toContain('aria-sort="ascending"');
    expect(table).toContain('<label for="');
  });

  /**
   * The audit from prompt 07.4: everything the drawing shows, the table shows too. The drawing is
   * rendered from the same topology, and each fact it carries is looked for in the table.
   */
  it("expresses everything the drawing shows", () => {
    const graph = text(renderToStaticMarkup(createElement(TopologyGraph, { topology })));
    for (const node of topology.nodes) {
      expect(tableText).toContain(node.label);
      for (const ip of node.ips) expect(tableText).toContain(ip);
      expect(tableText).toContain(STATE_LABEL[node.state]);
      for (const service of node.services)
        expect(tableText).toContain(`${service.port}/${service.protocol}`);
    }
    for (const subnet of topology.subnets) {
      expect(tableText).toContain(subnet.cidr);
      expect(tableText).toContain(subnet.name ?? "Network");
    }
    // "You are here", the line into another network, and the second address.
    expect(graph).toContain("You are here");
    expect(tableText).toContain("You are here");
    expect(tableText).toContain("Reached from your network, through a firewall");
    expect(tableText).toContain("10.0.2.20");
    // The "New!" label and the selected card.
    expect(tableText).toContain("New!");
    expect(table).toMatch(/<tr aria-current="true"[^>]*>[\s\S]*?web-01/);
    // States are spelt out and drawn as shapes, never colour alone.
    expect(tableText).toContain("What the states mean");
    expect((table.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(topology.nodes.length);
  });

  it("never shows a host the learner hasn't discovered", () => {
    expect(table).not.toMatch(/vault-01|10\.0\.2\.50/);
  });

  it("follows the voice-and-tone rules", () => {
    expect(findBannedWords(tableText)).toEqual([]);
  });
});

describe("HostInspector", () => {
  // netscan finds ports; fingerprinting (webprobe) fills in the program and banner. Give one
  // service those details, as a fingerprint would, to see them shown.
  const scanned = topology.nodes.find((node) => node.hostId === "web-01")!;
  const web = {
    ...scanned,
    services: scanned.services.map((service) =>
      service.port === 22
        ? { ...service, product: "sshd", version: "9.6", banner: "SSH-2.0-sshd_9.6" }
        : service,
    ),
  };
  const html = renderToStaticMarkup(
    createElement(HostInspector, {
      node: web,
      topology,
      log: discoveryLog(events),
      note: "Two networks!",
      onNoteChange: () => {},
      onClose: () => {},
    }),
  );
  const said = text(html);

  it("shows the addresses, networks, OS guess, services and banners it has seen", () => {
    expect(said).toContain("10.0.1.20 on Office (10.0.1.0/24)");
    expect(said).toContain("10.0.2.20 on Servers (10.0.2.0/24)");
    expect(said).toContain("22/tcp ssh · sshd 9.6");
    expect(said).toContain(": SSH-2.0-sshd_9.6");
    expect(said).toContain("Scanned · 2 services");
  });

  it("says which command revealed what", () => {
    expect(said).toContain("Found by netscan 10.0.1.0/24 -p common");
  });

  it("keeps the learner's notes, and says they aren't saved", () => {
    expect(html).toMatch(/<textarea[^>]*>Two networks!<\/textarea>/);
    expect(said).toContain("Nothing is saved.");
  });

  it("explains its words with the glossary", () => {
    for (const term of ["ip-address", "port", "service", "banner", "operating-system"]) {
      expect(html).toContain(term);
    }
  });
});

describe("NetworkMapPanel", () => {
  const html = renderToStaticMarkup(createElement(NetworkMapPanel, { topology, events }));

  it("shows the map, the found-so-far count, the view toggle and Export", () => {
    expect(html).toContain("Network map");
    expect(text(html)).toContain("2 computers found · keep scanning to find more");
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*Drawing/);
    expect(html).toContain("Export");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Simulated");
  });

  it("never counts what's left to find", () => {
    expect(text(html)).not.toMatch(/remaining|left to find|of \d+ computers/i);
  });
});

describe("export", () => {
  it("stamps the JSON as simulated and lists only what was discovered", () => {
    const data = topologyExport(topology, { source: "Map office" });
    expect(data).toMatchObject({
      format: "hacker-simulation.network-map",
      simulated: true,
      notice: SIMULATED_WATERMARK,
      source: "Map office",
      counts: { computersFound: 2, openPorts: 2 },
    });
    expect(data.computers.map((computer) => computer.name)).toEqual(["ws-01", "web-01", "db-01"]);
    expect(data.computers[1]).toMatchObject({
      addresses: ["10.0.1.20", "10.0.2.20"],
      networks: ["Office (10.0.1.0/24)", "Servers (10.0.2.0/24)"],
      stateLabel: "Scanned",
      services: [
        { port: 22, protocol: "tcp", service: "ssh" },
        { port: 80, protocol: "tcp", service: "http" },
      ],
    });
    const json = topologyExportJson(topology);
    expect(JSON.parse(json).notice).toBe("SIMULATED - not a real network");
    expect(json).not.toMatch(/vault-01|10\.0\.2\.50/);
  });

  it("draws the whole map as SVG with the watermark and the palette's colours", () => {
    const { svg, width, height } = topologyToSvg(topology, PALETTE, "Map <office> & co");
    expect(svg.startsWith("<svg xmlns=")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain("SIMULATED - NOT A REAL NETWORK");
    expect(svg).toContain("Map &lt;office&gt; &amp; co");
    for (const node of topology.nodes) expect(svg).toContain(`>${node.label}<`);
    expect(svg).not.toMatch(/vault-01|10\.0\.2\.50/);
    expect(svg).toContain(PALETTE.accent);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it("still exports an empty map, watermark and all", () => {
    const empty = selectTopology(createInitialState({ ...SPEC, session: SPEC.session }, 1));
    const { svg } = topologyToSvg({ ...empty, nodes: [], subnets: [], links: [] }, PALETTE);
    expect(svg).toContain("Nothing discovered yet.");
    expect(svg).toContain("SIMULATED");
  });
});
