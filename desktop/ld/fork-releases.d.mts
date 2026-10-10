export const releaseApi: string;
export type ForkResult =
  | { state: "up-to-date" }
  | { state: "manual-required"; version: string; releaseUrl: string };
export function ldVersion(value: string): number[];
export function releaseResult(
  release: unknown,
  currentVersion: string,
): ForkResult;
export function checkForkRelease(
  currentVersion: string,
  fetcher?: typeof fetch,
): Promise<ForkResult>;
