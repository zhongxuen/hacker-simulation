import ts from "typescript";

/**
 * Finds every reference to browser storage in a source file: localStorage, sessionStorage,
 * indexedDB, cookieStore, and document.cookie, however they're reached (window.localStorage,
 * globalThis["sessionStorage"], const { indexedDB } = self, …).
 *
 * It walks the TypeScript syntax tree rather than matching text, so comments and prose that
 * mention these names don't count. Used by tests/unit/storage-guard.test.ts.
 */

export const STORAGE_GLOBALS: ReadonlySet<string> = new Set([
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "cookieStore",
]);

export interface StorageAccess {
  /** 1-based line number. */
  line: number;
  /** What was reached: "localStorage", "document.cookie", … */
  name: string;
}

const SCRIPT_KINDS: Readonly<Record<string, ts.ScriptKind>> = {
  ".ts": ts.ScriptKind.TS,
  ".tsx": ts.ScriptKind.TSX,
  ".js": ts.ScriptKind.JS,
  ".jsx": ts.ScriptKind.JSX,
  ".mjs": ts.ScriptKind.JS,
  ".cjs": ts.ScriptKind.JS,
};

/** Whether `node` is `document`, or something ending in `.document` (window.document). */
function isDocument(node: ts.Expression): boolean {
  if (ts.isIdentifier(node)) return node.text === "document";
  if (ts.isPropertyAccessExpression(node)) return node.name.text === "document";
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
    return node.argumentExpression.text === "document";
  }
  return false;
}

export function findStorageAccess(source: string, fileName: string): StorageAccess[] {
  const extension = fileName.slice(fileName.lastIndexOf("."));
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    SCRIPT_KINDS[extension] ?? ts.ScriptKind.TS,
  );
  const found: StorageAccess[] = [];
  const record = (node: ts.Node, name: string) => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    found.push({ line: line + 1, name });
  };

  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && STORAGE_GLOBALS.has(node.text)) {
      record(node, node.text);
    } else if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      STORAGE_GLOBALS.has(node.argumentExpression.text)
    ) {
      record(node, node.argumentExpression.text);
    } else if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "cookie" &&
      isDocument(node.expression)
    ) {
      record(node, "document.cookie");
    } else if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === "cookie" &&
      isDocument(node.expression)
    ) {
      record(node, "document.cookie");
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  return found;
}
