# src/app/(app)

The product surface: campaign, missions, sandbox, terminal, network map, learning center, and settings, all inside the app shell (`layout.tsx`). There are no accounts, so no route here may ask anyone to sign up or sign in.

Never import here: a feature's internals (use `@/features/<name>`) or simulation internals. Keep pages thin.
