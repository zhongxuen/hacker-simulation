# src/sim/tools

Simulated tool behaviours (`netscan`, and so on). They get names distinct from real tools, and output that is representative, never a byte-copy of a real tool.

Never import here: anything outside `src/sim`. These tools only ever act on the simulated network.
