import { describe, expect, it } from "vitest";
import { errorCodes, eventTypes, fixtureState, run, text } from "../__fixtures__/harness";
import { htmlComments, parseWebTarget } from "./webprobe";

describe("webprobe", () => {
  it("fingerprints a web server and shows what its page gives away", () => {
    const result = run(fixtureState(), "webprobe", "10.0.1.20");
    expect(result.exitCode).toBe(0);
    expect(text(result)).toContain("HTTP/1.1 200 OK");
    expect(text(result)).toContain("Server: httpd/2.4.58");
    expect(text(result)).toContain("X-Powered-By: PageForge/3.1");
    expect(text(result)).toContain("Page title:   Staff portal");
    expect(text(result)).toContain("<!-- TODO: remove the test account before launch -->");
    expect(result.events).toContainEqual({
      type: "service.fingerprinted",
      hostId: "web-01",
      port: 80,
      product: "httpd",
      version: "2.4.58",
    });
    expect(result.events).toContainEqual({
      type: "web.probed",
      hostId: "web-01",
      port: 80,
      path: "/",
      status: 200,
    });
    expect(result.events).toContainEqual({ type: "flag.found", flagId: "view-source" });
  });

  it("puts what it learned into discovery", () => {
    const { state } = run(fixtureState(), "webprobe", "web-01");
    expect(state.discovery.hosts["web-01"]?.services["80/tcp"]).toMatchObject({
      name: "http",
      product: "httpd",
      version: "2.4.58",
      via: "webprobe",
    });
    expect(state.discovery.hosts["web-01"]?.portScanned).toBe(false);
  });

  it("fingerprints each service only once", () => {
    const first = run(fixtureState(), "webprobe", "web-01");
    const second = run(first.state, "webprobe", "web-01", "--path", "/admin");
    expect(eventTypes(second)).not.toContain("service.fingerprinted");
    expect(eventTypes(second)).not.toContain("service.discovered");
    expect(text(second)).toContain("HTTP/1.1 401 Unauthorized");
  });

  it("answers 404 for pages that don't exist", () => {
    expect(text(run(fixtureState(), "webprobe", "http://web-01/secret"))).toContain(
      "HTTP/1.1 404 Not Found",
    );
  });

  it("reaches a host that ignores pings, because it knocks on the web port directly", () => {
    const result = run(fixtureState(), "webprobe", "printer-01");
    expect(text(result)).toContain("Printer status");
    expect(result.events).toContainEqual({
      type: "host.discovered",
      hostId: "printer-01",
      ip: "10.0.1.30",
      via: "webprobe",
    });
  });

  it("learns the host exists from a refused or wrong-protocol connection", () => {
    const refused = run(fixtureState(), "webprobe", "10.0.1.20:8080");
    expect(errorCodes(refused)).toEqual(["CONNECTION_REFUSED"]);
    expect(refused.state.discovery.hosts["web-01"]).toBeDefined();
    const ssh = run(fixtureState(), "webprobe", "10.0.1.20", "--port", "22");
    expect(errorCodes(ssh)).toEqual(["PROTOCOL_MISMATCH"]);
    expect(ssh.output[0]?.error).toMatchObject({ expected: "http", found: "ssh", port: 22 });
    expect(ssh.state.discovery.hosts["web-01"]?.services["22/tcp"]?.name).toBe("ssh");
  });

  it("learns nothing when a firewall drops the connection", () => {
    for (const target of ["vault-01", "10.0.2.40:5432"]) {
      const state = fixtureState();
      const result = run(state, "webprobe", target);
      expect(errorCodes(result), target).toEqual(["HOST_UNREACHABLE"]);
      expect(result.state.discovery, target).toBe(state.discovery);
    }
  });

  it.each([
    [["webprobe"], "MISSING_ARGUMENT"],
    [["webprobe", "ftp://web-01/"], "BAD_ARGUMENT"],
    [["webprobe", "web-01:99999"], "BAD_ARGUMENT"],
    [["webprobe", "web-01", "--port", "http"], "BAD_ARGUMENT"],
    [["webprobe", "web-01", "--path", `/${"a".repeat(300)}`], "BAD_ARGUMENT"],
    [["webprobe", "10.0.9.9"], "HOST_UNREACHABLE"],
    [["webprobe", "nowhere"], "HOST_NOT_FOUND"],
    [["webprobe", "100.64.0.1"], "OUT_OF_SCOPE"],
    [["webprobe", "https://portal.corp/login"], "OUT_OF_SCOPE"],
  ])("%j fails with %s", (argv, code) => {
    expect(errorCodes(run(fixtureState(), ...argv))).toEqual([code]);
  });
});

describe("parseWebTarget", () => {
  it("understands URLs and host:port forms", () => {
    expect(parseWebTarget("https://web-01:8443/a/b?c")).toEqual({
      ok: true,
      value: { scheme: "https", host: "web-01", port: 8443, path: "/a/b?c" },
    });
    expect(parseWebTarget("10.0.1.20")).toEqual({ ok: true, value: { host: "10.0.1.20" } });
    expect(parseWebTarget("user@web-01").ok).toBe(false);
  });

  it("extracts HTML comments, trimmed", () => {
    expect(htmlComments("<p>a</p><!--  one \n two --><!----><!-- three -->")).toEqual([
      "one two",
      "three",
    ]);
  });
});
