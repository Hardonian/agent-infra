import { z } from 'zod';

export const ContractVersion = z.object({
  major: z.number().int().nonnegative(),
  minor: z.number().int().nonnegative(),
  patch: z.number().int().nonnegative(),
  preRelease: z.string().optional(),
});

export type ContractVersion = z.infer<typeof ContractVersion>;

export const ContractRange = z.object({
  min: ContractVersion,
  max: ContractVersion.optional(),
  exact: ContractVersion.optional(),
});

export type ContractRange = z.infer<typeof ContractRange>;

export const CONTRACT_VERSION_CURRENT: ContractVersion = {
  major: 1,
  minor: 0,
  patch: 0,
};

export function parseVersion(version: string): ContractVersion {
  const [core, pre] = version.split('-');
  const [major, minor, patch] = core.split('.').map(Number);

  return {
    major: major ?? 0,
    minor: minor ?? 0,
    patch: patch ?? 0,
    preRelease: pre,
  };
}

export function serializeVersion(v: ContractVersion): string {
  const core = `${v.major}.${v.minor}.${v.patch}`;
  return v.preRelease ? `${core}-${v.preRelease}` : core;
}

export function satisfiesRange(version: ContractVersion, range: ContractRange): boolean {
  if (range.exact) {
    return (
      version.major === range.exact.major &&
      version.minor === range.exact.minor &&
      version.patch === range.exact.patch
    );
  }

  const min = range.min;
  const max = range.max;

  if (version.major < min.major) return false;
  if (version.major === min.major && version.minor < min.minor) return false;
  if (version.major === min.major && version.minor === min.minor && version.patch < min.patch) {
    return false;
  }

  if (max) {
    if (version.major > max.major) return false;
    if (version.major === max.major && version.minor > max.minor) return false;
    if (version.major === max.major && version.minor === max.minor && version.patch > max.patch) {
      return false;
    }
  }

  return true;
}

export function isBreakingChange(
  oldVersion: ContractVersion,
  newVersion: ContractVersion
): boolean {
  return newVersion.major > oldVersion.major;
}
