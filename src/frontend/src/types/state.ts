export interface BackendState {
  readonly url: string;
  readonly connected: boolean;
  readonly revision?: number;
  readonly readAt?: number;
  readonly error?: { readonly code: string; readonly message: string };
}
