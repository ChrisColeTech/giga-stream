import { notConnected } from "./not-connected";
import type { BackendHealth } from "./schemas/health-schema";

/** `GET /healthz` (`29` section 6.3), public: the backend's version, revision and TMDB state for the gate and About. NOT
 *  CONNECTED: the shared request layer only sends `/api/` paths, so the root route needs its own base (`29` section 7);
 *  until then About shows dashes. */
export interface HealthService {
  read: () => Promise<BackendHealth>;
}

export const health: HealthService = {
  read: () => notConnected("health.read"),
};
