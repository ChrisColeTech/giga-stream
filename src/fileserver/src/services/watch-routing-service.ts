import type { AccountApiService, AccountRequest } from "./account-api-service.js";
import type { WatchService } from "./watch-service.js";

export interface WatchRouteRequest extends AccountRequest {
  electron: boolean;
}

export function createWatchRoutingService(local: WatchService, account: AccountApiService) {
  return {
    write(input: Parameters<WatchService["write"]>[0], request: WatchRouteRequest) {
      return request.electron ? Promise.resolve(local.write(input)) : account.writeWatch(input, request);
    },
    drop(id: string, request: WatchRouteRequest) {
      return request.electron ? Promise.resolve(local.drop(id)) : account.dropWatch(id, request);
    },
    clear(request: WatchRouteRequest) {
      return request.electron ? Promise.resolve(local.clear()) : account.clearWatch(request);
    },
  };
}

export type WatchRoutingService = ReturnType<typeof createWatchRoutingService>;
