// utils.js

// Funções utilitárias gerais para uso em todos os módulos.

export function clamp(val, min, max) {
    return Math.max(min, Math.min(val, max));
}

// Checagem se está numa zona segura (útil para inimigos, player, etc)
export function isInSafeZone(x, y, SAFE_ZONES, radius = 0) {
    return SAFE_ZONES.some(z => Math.hypot(x-z.x, y-z.y) < z.r + radius);
}

// Outras utilidades: (adicione conforme necessário)
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Exemplo de mensagem de evento (para HUD)
export function showEventMsg(msg, duration=3, msgQueue = null, eventMsgDiv = null) {
    if (msgQueue && eventMsgDiv) {
        msgQueue.push({msg: msg, t: duration});
        eventMsgDiv.innerHTML = msg;
        eventMsgDiv.style.display = "block";
    }
}
