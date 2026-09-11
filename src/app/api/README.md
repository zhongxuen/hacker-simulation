# src/app/api

Route handlers (server-only): objective checking, the AI Mentor proxy, and similar. Secrets and answer keys stay here, never in client code.

Never import here: React components or client-only code. Validate every request body before using it.
