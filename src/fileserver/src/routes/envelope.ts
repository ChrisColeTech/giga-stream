/** The one envelope every route answers in (docs/03 section 2). */
export type Success<T> = { ok: true; data: T };
export type Failure = { ok: false; error: { code: string; message: string } };

export const ok = <T>(data: T): Success<T> => ({ ok: true, data });

export const fail = (code: string, message: string): Failure => ({ ok: false, error: { code, message } });
