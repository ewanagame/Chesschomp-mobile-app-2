/** Wait until player-move classification has settled and the badge can paint. */
export async function waitUntilPlayerMoveQualityVisible(
  classification: Promise<void>,
  waitForPaint: () => Promise<void>,
): Promise<void> {
  await classification;
  await waitForPaint();
}
