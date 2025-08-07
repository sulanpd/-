// utils.js
export function clamp(val, min, max) {
  return Math.max(min, Math.min(val, max));
}

export function isInSafeZone(x, y, SAFE_ZONES, radius = 0) {
  return SAFE_ZONES.some(z => Math.hypot(x - z.x, y - z.y) < z.r + radius);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function showEventMsg(msg, duration = 3, msgQueue = null, eventMsgDiv = null) {
  if (msgQueue && eventMsgDiv) {
    msgQueue.push({ msg, t: duration });
    eventMsgDiv.innerHTML = msg;
    eventMsgDiv.style.display = "block";
  }
}
