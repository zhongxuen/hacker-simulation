import type { Metadata } from "next";
import { getAppSection } from "@/lib/app-sections";
import { LazySandboxWorkspace } from "./lazy-sandbox-workspace";

export const metadata: Metadata = { title: getAppSection("sandbox").label };

export default function SandboxPage() {
  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Practice freely. Nothing can break.
        </h1>
        <p className="mt-4 text-lg leading-8 text-secondary">
          The sandbox is a practice space on the Range, your team&apos;s training lab. Pick a
          machine and try any command as often as you like. There are no goals and no score, and
          nothing here touches a real computer.
        </p>
      </div>
      <LazySandboxWorkspace />
    </div>
  );
}
