/** Invalidates asynchronous opens so only the newest requested item can commit. */
export class PlayerNavigation {
  private generation = 0;

  next(): number {
    this.generation += 1;
    return this.generation;
  }

  isLatest(generation: number): boolean {
    return generation === this.generation;
  }
}

export async function settleLatestNavigation(
  navigation: PlayerNavigation,
  generation: number,
  settle: Promise<void>,
  onCurrentFailure: (error: unknown) => void,
): Promise<boolean> {
  try {
    await settle;
  } catch (error: unknown) {
    if (navigation.isLatest(generation)) onCurrentFailure(error);
  }
  return navigation.isLatest(generation);
}
