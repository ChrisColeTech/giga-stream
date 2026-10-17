export interface AdminDraftState {
  readonly draft: string;
  readonly sent: string;
  readonly edited: boolean;
  readonly submittedRevision: number | null;
  readonly editedAfterSubmit: boolean;
}

export function initialAdminDraft(adminUrl: string): AdminDraftState {
  return { draft: adminUrl, sent: adminUrl, edited: false, submittedRevision: null, editedAfterSubmit: false };
}

/** Reconciles a saved answer without replacing text typed after the submitted address. */
export function reconcileAdminDraft(
  state: AdminDraftState,
  adminUrl: string,
  savedRevision: number,
): AdminDraftState {
  if (state.submittedRevision !== null && savedRevision >= state.submittedRevision) {
    if (state.editedAfterSubmit) {
      return { ...state, sent: adminUrl, submittedRevision: null, editedAfterSubmit: false };
    }
    return initialAdminDraft(adminUrl);
  }
  if (state.submittedRevision === null && !state.edited && state.draft !== adminUrl) {
    return initialAdminDraft(adminUrl);
  }
  return state;
}
