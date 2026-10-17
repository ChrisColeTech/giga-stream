import { notConnected, type ServiceResult } from "./not-connected";

/** Saves one setting (`03` section 3.2). Phase 1 stub; the value stays in the window until phase 2. */
export function saveSetting(_key: string, _value: string | number | boolean | null): ServiceResult {
  return notConnected();
}

/** Reads the licence texts the fileserver bundles (`03` section 3.2, About), to show in Settings. Phase 1 stub. */
export function readLicences(): ServiceResult {
  return notConnected();
}
