/**
 * webprobe: asks a simulated web service for one page and reports what it gives away: the status,
 * the headers, the page title, any HTML comments left in the source, and a product fingerprint.
 */
import { err, ok, type Result } from "../core/result";
import type { SimError } from "../core/errors";
import { failure, stdout, success } from "../core/output";
import { sessionHost, withDiscovery } from "../core/session";
import type { OutputLine, SimEvent } from "../core/types";
import { recordHost, recordService } from "../net/discovery";
import { canReach, osGuess, serviceAt } from "../net/graph";
import type { HttpPage, Service } from "../net/types";
import { optionValue, parseArgs } from "./args";
import { resolveEndpoint } from "./target";
import type { Tool } from "./types";

const NAME = "webprobe";
const MAX_PATH_LENGTH = 200;
const MAX_COMMENTS = 10;

const STATUS_TEXT: Readonly<Record<number, string>> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

const NOT_FOUND: HttpPage = { status: 404, title: "404 Not Found", body: "<h1>Not Found</h1>" };

export interface WebTarget {
  readonly scheme?: "http" | "https";
  readonly host: string;
  readonly port?: number;
  readonly path?: string;
}

/** "http://web-01:8080/admin", "web-01:8080", or "10.0.1.20". Nothing is fetched; this only parses. */
export function parseWebTarget(raw: string): Result<WebTarget, SimError> {
  const bad = (reason: "bad-format" | "out-of-range") =>
    err<SimError>({ code: "BAD_ARGUMENT", argument: "target", value: raw, reason });
  let rest = raw;
  let scheme: WebTarget["scheme"];
  const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\//i.exec(rest);
  if (schemeMatch) {
    const name = (schemeMatch[1] as string).toLowerCase();
    if (name !== "http" && name !== "https") return bad("bad-format");
    scheme = name;
    rest = rest.slice(schemeMatch[0].length);
  }
  const slash = rest.indexOf("/");
  const authority = slash === -1 ? rest : rest.slice(0, slash);
  const path = slash === -1 ? undefined : rest.slice(slash);
  const match = /^([^:@\s]+)(?::(\d{1,5}))?$/.exec(authority);
  if (!match) return bad("bad-format");
  const port = match[2] === undefined ? undefined : Number(match[2]);
  if (port !== undefined && (port < 1 || port > 65535)) return bad("out-of-range");
  return ok({
    host: match[1] as string,
    ...(scheme && { scheme }),
    ...(port !== undefined && { port }),
    ...(path !== undefined && { path }),
  });
}

/** Text inside `<!-- ... -->`, trimmed, in order. */
export function htmlComments(body: string): string[] {
  const comments: string[] = [];
  const pattern = /<!--([\s\S]*?)-->/g;
  for (
    let match = pattern.exec(body);
    match && comments.length < MAX_COMMENTS;
    match = pattern.exec(body)
  ) {
    const text = (match[1] as string).trim().replace(/\s+/g, " ");
    if (text) comments.push(text);
  }
  return comments;
}

export const webprobe: Tool = {
  name: NAME,
  category: "network",
  help: {
    oneLiner: "ask a website for one page, and see what it tells you about itself.",
    usage: ["webprobe <address or name>", "webprobe http://<address>:<port>/<path>"],
    description: [
      "Websites run on programs called web servers. When your browser asks for a page, the server sends back the page plus extra lines called headers. The first line is a status code: 200 means OK, 404 means there's no such page.",
      "webprobe asks for one page and shows the status, the headers, the page title, and any hidden notes (HTML comments) the developers left in the page's source code. From the headers it guesses which web server program is running and which version. That guess is called a fingerprint.",
      "Browsers and web servers talk in a language called HTTP. Web servers usually listen on port 80 for http, or port 443 for https, the same language sent scrambled so nobody in between can read it. Use --port, or add :8080 after the address, to try another port.",
    ],
    options: [
      {
        flags: "--port <number>",
        text: "Which port to connect to. Defaults to 80, or 443 for https://.",
      },
      { flags: "--path <path>", text: "Which page to ask for, like /admin. Defaults to /." },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      { command: "webprobe 10.0.1.20", text: "Ask the computer at 10.0.1.20 for its home page." },
      {
        command: "webprobe web-01 --path /admin",
        text: "Check whether web-01 has an /admin page.",
      },
      { command: "webprobe http://web-01:8080/", text: "Try a web server on port 8080." },
    ],
    concept: [
      "Web servers often say more than they should. A version number in a header tells an attacker exactly which known weaknesses to try, and a comment in the page source can leak a password or a hidden page. Defenders check their own sites for this and remove it.",
      "Only probe websites you have permission to test. This practice network is set up for your team, so here it's fine.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [
      { names: ["--port"], key: "port", takesValue: true },
      { names: ["--path"], key: "path", takesValue: true },
    ]);
    if (!parsed.ok) return failure(NAME, parsed.error, state);
    const [raw, extra] = parsed.value.positionals;
    if (raw === undefined)
      return failure(NAME, { code: "MISSING_ARGUMENT", argument: "target" }, state);
    if (extra !== undefined) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "target", value: extra, reason: "extra-argument" },
        state,
      );
    }
    const web = parseWebTarget(raw);
    if (!web.ok) return failure(NAME, web.error, state);

    const portText = optionValue(parsed.value, "port");
    let port = web.value.port ?? (web.value.scheme === "https" ? 443 : 80);
    if (portText !== undefined) {
      port = Number(portText);
      if (!/^\d{1,5}$/.test(portText) || port < 1 || port > 65535) {
        return failure(
          NAME,
          { code: "BAD_ARGUMENT", argument: "--port", value: portText, reason: "out-of-range" },
          state,
        );
      }
    }
    let path = optionValue(parsed.value, "path") ?? web.value.path ?? "/";
    if (!path.startsWith("/")) path = `/${path}`;
    if (path.length > MAX_PATH_LENGTH) {
      return failure(
        NAME,
        { code: "BAD_ARGUMENT", argument: "--path", value: path, reason: "too-long" },
        state,
      );
    }

    const endpoint = resolveEndpoint(state.network, web.value.host, port);
    if (!endpoint.ok) return failure(NAME, endpoint.error, state);
    const { host, ip, display } = endpoint.value;
    const from = sessionHost(state);
    const service: Service | undefined = serviceAt(host, port);
    // A firewall drops the connection silently: no reply, and nothing learned.
    if (!canReach(state.network, from.id, host.id, service)) {
      return failure(NAME, { code: "HOST_UNREACHABLE", target: display, port }, state);
    }

    // The host answered, so the learner now knows it exists, even if the port turns out closed.
    let discovery = state.discovery;
    const events: SimEvent[] = [];
    const seenHost = recordHost(discovery, {
      hostId: host.id,
      ip,
      hostname: host.hostname,
      via: NAME,
      tick: ctx.tick,
    });
    discovery = seenHost.discovery;
    if (seenHost.isNew) events.push({ type: "host.discovered", hostId: host.id, ip, via: NAME });

    if (!service) {
      return failure(
        NAME,
        { code: "CONNECTION_REFUSED", target: display, port },
        withDiscovery(state, discovery),
        events,
      );
    }
    const seenService = recordService(discovery, host.id, {
      port,
      protocol: service.protocol,
      name: service.name,
      via: NAME,
      tick: ctx.tick,
    });
    discovery = seenService.discovery;
    if (seenService.isNew) {
      events.push({
        type: "service.discovered",
        hostId: host.id,
        ip,
        port,
        protocol: service.protocol,
        service: service.name,
        via: NAME,
      });
    }
    if (!service.http) {
      const error: SimError = {
        code: "PROTOCOL_MISMATCH",
        target: display,
        port,
        expected: "http",
        found: service.name,
      };
      return failure(NAME, error, withDiscovery(state, discovery), events);
    }

    const page = Object.hasOwn(service.http.pages, path)
      ? (service.http.pages[path] as HttpPage)
      : NOT_FOUND;
    const server = `${service.product}/${service.version}`;
    const headers: [string, string][] = [
      ["Server", server],
      ...Object.entries({ ...service.http.headers, ...page.headers }).filter(
        ([name]) => name.toLowerCase() !== "server",
      ),
    ];
    const statusText = STATUS_TEXT[page.status] ?? "";
    const scheme = service.name === "https" ? "https" : "http";
    const defaultPort = scheme === "https" ? 443 : 80;
    const url = `${scheme}://${display}${port === defaultPort ? "" : `:${port}`}${path}`;
    const comments = htmlComments(page.body ?? "");

    const output: OutputLine[] = [
      stdout(`webprobe (simulated) · ${url} · ${host.hostname} (${ip})`),
      stdout(""),
      stdout(`HTTP/1.1 ${page.status} ${statusText}`.trimEnd()),
      ...headers.map(([name, value]) => stdout(`  ${name}: ${value}`)),
      stdout(""),
      stdout(`Page title:   ${page.title ?? "(none)"}`),
    ];
    if (comments.length > 0) {
      output.push(stdout("HTML comments (notes left in the page source):"));
      output.push(...comments.map((comment) => stdout(`  <!-- ${comment} -->`)));
    }
    output.push(
      stdout(`Fingerprint:  ${service.product} ${service.version} · OS guess: ${osGuess(host.os)}`),
    );

    const fingerprinted = recordService(discovery, host.id, {
      port,
      protocol: service.protocol,
      name: service.name,
      product: service.product,
      version: service.version,
      banner: server,
      via: NAME,
      tick: ctx.tick,
    });
    const firstFingerprint = fingerprinted.discovery !== discovery;
    discovery = fingerprinted.discovery;
    if (firstFingerprint) {
      events.push({
        type: "service.fingerprinted",
        hostId: host.id,
        port,
        product: service.product,
        version: service.version,
      });
    }
    events.push({ type: "web.probed", hostId: host.id, port, path, status: page.status });
    return success(withDiscovery(state, discovery), output, events);
  },
};
