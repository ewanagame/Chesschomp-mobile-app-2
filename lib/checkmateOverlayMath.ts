/** Sword art points straight down at 0° rotation. */
export function swordRotationDegrees(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return angleDeg - 90;
}
