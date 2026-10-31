/**
 * The hub's Composed World tile opens this app as a trainer of its own:
 * `apps/world` sends the page here with `?trainer=world`, and that page load is
 * pinned to Composed World whatever the player's own Syllogimous settings say.
 *
 * Read once, at load: the router drops the query on its first redirect. A
 * reload of the same page keeps the pin — sessionStorage carries it — but any
 * other load clears it, because the hub shows every tile in one frame: the
 * Syllogimous tile opened after Composed World, in the same tab, has to be
 * Syllogimous again, and it shares this sessionStorage.
 */
const PIN_KEY = "SYL_PIN";

function pinned(): boolean {
    try {
        if (/[?&]trainer=world(&|$)/.test(location.search)) {
            sessionStorage.setItem(PIN_KEY, "world");
            return true;
        }
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (nav?.type === "reload" && sessionStorage.getItem(PIN_KEY) === "world") return true;
        sessionStorage.removeItem(PIN_KEY);
    } catch { /* no window (the tests), or storage refused: not pinned */ }
    return false;
}

export const WORLD_PINNED = pinned();

/* The tab, and the hub's standalone link, say which trainer this is. */
if (WORLD_PINNED) { try { document.title = "Composed World"; } catch { /* no document */ } }
