/** Hill function (same form as pd.ts) for test assertions. */
export const hill = (x: number, ec50: number, g: number): number => {
  const a = Math.max(0, x) ** g;
  return a / (ec50 ** g + a);
};
