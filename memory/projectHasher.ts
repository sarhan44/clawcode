/**
 * Stable hash of project path for session memory file names.
 * Cross-platform: normalizes path separators and casing where appropriate.
 */

import { createHash } from "node:crypto";
import { normalize, resolve } from "node:path";

const HASH_LENGTH = 16;

/**
 * Returns a short stable hash for the given project root path.
 * Same path always yields the same hash; works across platforms.
 */
export function getProjectHash(projectRoot: string): string {
  const normalized = normalize(resolve(projectRoot));
  const hash = createHash("sha256").update(normalized, "utf8").digest("hex");
  return hash.slice(0, HASH_LENGTH);
}
