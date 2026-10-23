import { freemem, totalmem, loadavg, cpus } from 'node:os';
import { statfsSync } from 'node:fs';

export const CAPABILITY = Object.freeze({ FULL: 'full', LOCAL: 'reduced_local', READ_ONLY: 'read_only', HALT: 'safe_halt' });

/** Deterministic, conservative gate. No model-generated text can raise this level. */
export function capabilityState({ freeBytes, totalBytes, load, cores, diskFreeBytes, localAvailable, remoteAvailable }, limits = {}) {
  const haltFree = limits.haltFreeBytes ?? 256 * 1024 ** 2;
  const lowFree = limits.lowFreeBytes ?? 1024 ** 3;
  const haltDisk = limits.haltDiskBytes ?? 128 * 1024 ** 2;
  if (![freeBytes, totalBytes, load, cores, diskFreeBytes].every(Number.isFinite) || totalBytes <= 0 || cores <= 0)
    return { level: CAPABILITY.HALT, reason: 'Resource telemetry unavailable', toolsAllowed: false };
  if (freeBytes < haltFree || diskFreeBytes < haltDisk)
    return { level: CAPABILITY.HALT, reason: 'Critical host memory or disk pressure', toolsAllowed: false };
  if (freeBytes < lowFree || freeBytes / totalBytes < 0.08 || load / cores > 2)
    return { level: CAPABILITY.READ_ONLY, reason: 'Host under pressure; mutating tools paused', toolsAllowed: false };
  if (!remoteAvailable) return localAvailable
    ? { level: CAPABILITY.LOCAL, reason: 'Remote model unavailable; local fallback only', toolsAllowed: false }
    : { level: CAPABILITY.READ_ONLY, reason: 'No reachable inference provider', toolsAllowed: false };
  return { level: CAPABILITY.FULL, reason: 'Resources within configured limits', toolsAllowed: true };
}

export function hostSnapshot() {
  const cpusAvailable = cpus().length;
  let diskFreeBytes = NaN;
  try { const fs = statfsSync(process.cwd()); diskFreeBytes = fs.bavail * fs.bsize; } catch {}
  return { freeBytes: freemem(), totalBytes: totalmem(), load: loadavg()[0], cores: cpusAvailable, diskFreeBytes };
}
