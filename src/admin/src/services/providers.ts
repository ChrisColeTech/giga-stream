import { notConnected } from "./not-connected";
import type { AdminProvider } from "./schemas/provider-schema";
import type { RecordService } from "./service-types";

/** The Providers routes (`29` section 9.2). NOT CONNECTED: refuses until the Providers worker wires it. */
export type ProvidersService = RecordService<AdminProvider, number>;

export const providers: ProvidersService = {
  list: () => notConnected("providers.list"),
  create: () => notConnected("providers.create"),
  update: () => notConnected("providers.update"),
  remove: () => notConnected("providers.remove"),
};
