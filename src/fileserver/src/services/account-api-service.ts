import type { AccountDataService, AccountSettings } from "./account-data-service.js";
import type { AccountService } from "./account-service.js";

export interface AccountRequest {
  authorization?: string;
  address?: string;
}

const actorOf = (request: AccountRequest) => ({
  ...(request.address !== undefined && { address: request.address }),
});

/** One-call route facade: authentication and domain work stay behind the route boundary. */
export function createAccountApiService(auth: AccountService, data: AccountDataService) {
  const principal = (request: AccountRequest) => auth.authenticate(request.authorization);
  return {
    register: (input: Parameters<AccountService["register"]>[0], request: AccountRequest) =>
      auth.register(input, actorOf(request)),
    login: (username: string, password: string, request: AccountRequest) =>
      auth.login(username, password, actorOf(request)),
    refresh: (token: string) => auth.refresh(token),
    logout: (token: string, request: AccountRequest) => auth.logout(token, actorOf(request)),
    resetStart: (username: string) => auth.resetStart(username),
    reset: (username: string, answer: string, password: string, request: AccountRequest) =>
      auth.reset(username, answer, password, actorOf(request)),
    async password(current: string, next: string, request: AccountRequest) {
      const signedIn = await principal(request);
      return auth.changePassword(signedIn, current, next, actorOf(request));
    },
    async me(request: AccountRequest) { return auth.me(await principal(request)); },
    async username(username: string, request: AccountRequest) {
      const signedIn = await principal(request);
      return auth.updateUsername(signedIn, username, actorOf(request));
    },
    async settings(request: AccountRequest) { return data.settings(await principal(request)); },
    async writeSettings(value: AccountSettings, request: AccountRequest) {
      const signedIn = await principal(request);
      return data.writeSettings(signedIn, value, actorOf(request));
    },
    async favorites(request: AccountRequest) { return data.favorites(await principal(request)); },
    async favorite(kind: "title" | "local", id: string, value: boolean, request: AccountRequest) {
      const signedIn = await principal(request);
      return data.favorite(signedIn, kind, id, value, actorOf(request));
    },
    async collections(request: AccountRequest) { return data.collections(await principal(request)); },
    async createCollection(
      name: string, type: "movie" | "tv" | "local", request: AccountRequest,
    ) {
      const signedIn = await principal(request);
      return data.createCollection(signedIn, name, type, actorOf(request));
    },
    async updateCollection(
      id: string, patch: { name?: string; type?: "movie" | "tv" | "local" }, request: AccountRequest,
    ) {
      const signedIn = await principal(request);
      return data.updateCollection(signedIn, id, patch, actorOf(request));
    },
    async removeCollection(id: string, request: AccountRequest) {
      const signedIn = await principal(request);
      return data.removeCollection(signedIn, id, actorOf(request));
    },
    async setCollectionItem(
      id: string, kind: "title" | "local", itemId: string, add: boolean, request: AccountRequest,
    ) {
      const signedIn = await principal(request);
      return data.setCollectionItem(signedIn, id, kind, itemId, add, actorOf(request));
    },
    async memberships(kind: "title" | "local", id: string, request: AccountRequest) {
      return data.memberships(await principal(request), kind, id);
    },
    async watch(request: AccountRequest) { return data.listWatch(await principal(request)); },
    async writeWatch(input: Parameters<AccountDataService["writeWatch"]>[1], request: AccountRequest) {
      const signedIn = await principal(request);
      return data.writeWatch(signedIn, input, actorOf(request));
    },
    async dropWatch(id: string, request: AccountRequest) {
      const signedIn = await principal(request);
      return data.dropWatch(signedIn, id, actorOf(request));
    },
    async clearWatch(request: AccountRequest) {
      const signedIn = await principal(request);
      return data.clearWatch(signedIn, actorOf(request));
    },
  };
}

export type AccountApiService = ReturnType<typeof createAccountApiService>;
