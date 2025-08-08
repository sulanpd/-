/* ========================================================================
 * utils.js
 * Utilitários simples e estáveis
 * ===================================================================== */
export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}