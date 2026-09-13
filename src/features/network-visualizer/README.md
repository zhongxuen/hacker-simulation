# src/features/network-visualizer

The fog-of-war network map (phase 07). It renders what the learner has discovered, and nothing else: whoever owns the simulation state calls `selectTopology(state)` from `@/sim` and passes the result in. Nothing here reads or changes simulation state.

- `components/topology-graph.tsx`: `TopologyGraph`, the SVG map (`"use client"`). Props: `topology`, `selectedHostId?`, `onSelectHost?`, `showLegend?`, `className?`. Pan by dragging, zoom with the wheel, a pinch or the zoom buttons. With a card focused: arrow keys move between cards, Enter or Space selects, `+`/`-` zoom, `0` fits, Shift + arrow keys scroll. One card is in the Tab order at a time.
- `components/map-layers.tsx`: the drawing itself (subnet boxes, lines, host cards), memoized so panning never re-renders a card.
- `components/node-glyph.tsx`: each state's shape and colour. `components/topology-legend.tsx`: the map key.
- `layout.ts`: the pure, deterministic layout. Subnets are columns in address order, hosts stack in address order, and every column has the same height, so a new host only moves the hosts after it in its own subnet.
- `view.ts`: pure pan and zoom maths. `copy.ts`: every word the map shows, so the table view (07.4) can say the same things.

Rules: semantic colour tokens only (`tests/unit/no-hardcoded-colours.test.ts`), motion only through `src/styles/motion.css` utilities (so reduced motion snaps), and never colour alone for a host's state: each has a shape and a word ("Heard of", "Found", "Scanned", "Accessed"). Tests: `tests/unit/topology-layout.test.ts` and `tests/unit/topology-graph.test.ts`.

Public API: `index.ts` only. Never import here: another feature's internals, or runtime code from `@/sim` inside components (types from `@/sim/types` are fine).
