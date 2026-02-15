export type CreateBoardUiState = 'idle' | 'loading' | 'success' | 'error';

export function getCreateBoardErrorCopy(errorMessage?: string | null): string {
  if (errorMessage && errorMessage.trim().length > 0) {
    return errorMessage;
  }

  return 'Could not create board. Check your board title and workspace selection, then retry.';
}

export function getCreateBoardStatusCopy(state: CreateBoardUiState, errorMessage?: string | null): string {
  if (state === 'loading') {
    return 'Creating board… please wait.';
  }

  if (state === 'success') {
    return 'Board created successfully. Open it from the sidebar on the left.';
  }

  if (state === 'error') {
    return getCreateBoardErrorCopy(errorMessage);
  }

  return '';
}
