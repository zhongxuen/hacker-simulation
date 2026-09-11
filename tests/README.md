# tests

Tests that live outside `src`. Engine unit tests may also sit next to their code as `*.test.ts`.

Never import here: anything that touches a real network or service. Tests run offline.
