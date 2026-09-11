# src/sim/fs

The virtual filesystem: in-memory files, folders, and permissions for simulated hosts.

Never import here: Node's `fs` or any real filesystem access. Nothing here reads or writes the user's disk.
