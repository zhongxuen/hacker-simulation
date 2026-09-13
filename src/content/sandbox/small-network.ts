import type { SandboxScenario } from "./types";

const README = `This is the Range's practice network: a handful of computers
set up for your team to explore. The network map lights up as you
find them.

Some things to try:
  ifconfig                          see your own address
  netscan 192.168.60.0/24           find the computers that are on
  netscan range-web-01 -p common    check which doors (ports) are open
  webprobe range-web-01             look at a web server's home page
  ping range-files-01               ask a computer if it's there

One computer ignores pings. Another only talks to the web server.
`;

const linux = { family: "linux", name: "Linux", version: "6.8" } as const;
const ssh = { port: 22, protocol: "tcp", name: "ssh", product: "sshd", version: "9.6" } as const;
const RANGE = "192.168.60.0/24";

export const SMALL_NETWORK: SandboxScenario = {
  id: "sandbox-network",
  title: "Small network",
  description: "Five practice computers to find with scans. Watch the map fill in as you go.",
  tryThis: [
    { command: "netscan 192.168.60.0/24", why: "Find the computers that are switched on" },
    { command: "netscan range-web-01 -p common", why: "See which doors (ports) are open" },
    { command: "webprobe range-web-01", why: "Ask the web server for its home page" },
    { command: "cat README.txt", why: "Read the hints for this network" },
  ],
  showMap: true,
  seed: 6002,
  scenario: {
    id: "sandbox-network",
    network: {
      subnets: [{ cidr: RANGE, name: "The Range" }],
      hosts: [
        {
          id: "range-ws-01",
          hostname: "range-ws-01.range.candlewright.example",
          interfaces: [{ ip: "192.168.60.10", subnet: RANGE }],
          os: linux,
          services: [ssh],
          users: [{ name: "recruit", uid: 1000, groups: ["adm"] }],
          fs: {
            entries: [
              { path: "/home/recruit/README.txt", content: README },
              {
                path: "/home/recruit/scope.txt",
                content:
                  "Scope letter (practice)\nMay test: every computer in 192.168.60.0/24, the Range.\nMay not test: anything else.\nSigned: Theo Ashgrove, team lead\n",
              },
            ],
          },
        },
        {
          id: "range-web-01",
          hostname: "range-web-01.range.candlewright.example",
          interfaces: [{ ip: "192.168.60.20", subnet: RANGE }],
          os: linux,
          services: [
            ssh,
            {
              port: 80,
              protocol: "tcp",
              name: "http",
              product: "httpd",
              version: "2.4.58",
              http: {
                headers: { "X-Powered-By": "PageForge/3.1" },
                pages: {
                  "/": {
                    status: 200,
                    title: "Range intranet",
                    body: "<html><head><title>Range intranet</title></head><body><h1>Range intranet</h1><!-- note to self: the practice admin page is at /admin --><!-- SIM{read-the-source} --></body></html>",
                  },
                  "/admin": { status: 401, title: "Sign in required" },
                  "/robots.txt": {
                    status: 200,
                    title: "robots.txt",
                    body: "User-agent: *\nDisallow: /admin",
                  },
                },
              },
            },
          ],
        },
        {
          id: "range-files-01",
          hostname: "range-files-01.range.candlewright.example",
          interfaces: [{ ip: "192.168.60.30", subnet: RANGE }],
          os: linux,
          services: [
            ssh,
            {
              port: 21,
              protocol: "tcp",
              name: "ftp",
              product: "ftpd",
              version: "3.0",
              banner: "220 range-files-01 practice file server",
            },
            { port: 445, protocol: "tcp", name: "fileshare", product: "shared", version: "4.19" },
          ],
        },
        {
          id: "range-printer-01",
          hostname: "range-printer-01",
          interfaces: [{ ip: "192.168.60.40", subnet: RANGE }],
          os: { family: "embedded", name: "Printer firmware" },
          respondsToPing: false,
          services: [
            {
              port: 80,
              protocol: "tcp",
              name: "http",
              product: "printd-web",
              version: "1.2",
              http: { pages: { "/": { status: 200, title: "Printer status: paper low" } } },
            },
            { port: 9100, protocol: "tcp", name: "printer", product: "printd", version: "1.2" },
          ],
        },
        {
          id: "range-db-01",
          hostname: "range-db-01.range.candlewright.example",
          interfaces: [{ ip: "192.168.60.50", subnet: RANGE }],
          os: linux,
          services: [
            ssh,
            // The database only accepts the web server: a firewall rule on one port.
            {
              port: 5432,
              protocol: "tcp",
              name: "sql",
              product: "sqld",
              version: "15.4",
              reachableFrom: ["range-web-01"],
            },
          ],
        },
      ],
    },
    session: { host: "range-ws-01", user: "recruit" },
    flags: [{ id: "view-source", token: "SIM{read-the-source}" }],
  },
};
