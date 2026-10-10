export const releaseApi =
  "https://api.github.com/repos/LastDreamTeam/buzz_LDVersion/releases/latest";
const releaseBase =
  "https://github.com/LastDreamTeam/buzz_LDVersion/releases/tag/";

// This channel only accepts LD desktop releases. Do not accidentally offer an
// upstream release, a server artifact, or an unknown semantic version format.
export function ldVersion(value) {
  const match = /^(?:desktop-v|v)?(\d+)\.(\d+)\.(\d+)-ld\.(\d+)$/.exec(value);
  if (!match) throw new Error("Unrecognized LD desktop version");
  const parts = match.slice(1).map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error("Invalid LD version");
  return parts;
}

export function releaseResult(release, currentVersion) {
  if (release.draft || release.prerelease)
    throw new Error("Release is not published on the LD desktop channel");
  const remote = ldVersion(release.tag_name);
  const local = ldVersion(currentVersion);
  const version = remote.slice(0, 3).join(".") + "-ld." + remote[3];
  const expectedUrl = releaseBase + release.tag_name;
  if (release.html_url !== expectedUrl)
    throw new Error("Unexpected LD release URL");
  const assets = release.assets;
  for (const name of [
    `Buzz_${version}_x64-setup.exe`,
    "SHA256SUMS",
    "SOURCE_COMMIT",
  ]) {
    if (
      !Array.isArray(assets) ||
      !assets.some(
        (asset) =>
          asset.name === name && asset.state === "uploaded" && asset.size > 0,
      )
    )
      throw new Error("LD release assets are incomplete");
  }
  let newer = false;
  for (let i = 0; i < local.length; i++) {
    if (remote[i] !== local[i]) {
      newer = remote[i] > local[i];
      break;
    }
  }
  return newer
    ? { state: "manual-required", version, releaseUrl: expectedUrl }
    : { state: "up-to-date" };
}

export async function checkForkRelease(currentVersion, fetcher = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetcher(releaseApi, {
      headers: { Accept: "application/vnd.github+json" },
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(`LD release check failed: HTTP ${response.status}`);
    return releaseResult(await response.json(), currentVersion);
  } finally {
    clearTimeout(timeout);
  }
}
