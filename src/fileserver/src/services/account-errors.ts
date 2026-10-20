import { AppError } from "../lib/app-error.js";

export const invalidCredentials = () =>
  new AppError("auth.invalid_credentials", 401, "The username or password is not valid.");
export const invalidRefresh = () =>
  new AppError("auth.refresh_invalid", 401, "That session cannot be refreshed.");
export const unauthorized = () => new AppError("auth.unauthorized", 401, "Sign in to do that.");
export const usernameTaken = () => new AppError(
  "account.username_taken", 409, "That username is already in use.", { field: "username" },
);

export function isUnique(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}
