/** The one envelope (docs/01 section 8); no route invents another shape. */
export interface SuccessEnvelope<T> {
  ok: true;
  data: T;
}

export interface ErrorEnvelope {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    correlationId?: string;
  };
}
