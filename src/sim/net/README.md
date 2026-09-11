# src/sim/net

Virtual hosts, services, and the network graph. Addresses come from reserved ranges only (`10.x`, `192.168.x`, `example.*`).

Never import here: `net`, `http`, `dns`, `fetch`, or anything that opens a real socket or resolves a real host.
