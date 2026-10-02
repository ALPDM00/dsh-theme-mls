// dsh-theme-mls — Host-side half.
//
// Marathon is a Client-side theme plugin: every token, every rule and every
// animation lands from `client.js`. The Host half owns exactly one thing —
// the browser's **pre-plugin interval**, the few hundred milliseconds between
// the first paint and the moment the theme's client bundle runs.
//
// During that window DSH paints its own boot screen (the "HARNESS" wordmark,
// a spinning arc and "Loading plugins…"), which is not something a client
// plugin can reach: it is already on screen before any plugin bundle is even
// fetched. The Host half removes it through the webserver's structured
// index-injection seam (`webserver/index-inject`), i.e. one `<style>` row in
// the served index.html <head> — earlier than every stylesheet and every
// plugin, so there is no unstyled first frame and nothing to flash.
//
// This keeps the whole thing inside our own package: no node_modules patch,
// no host file edit, nothing to redo when the Harness version moves.

const name = 'dsh-theme-mls'

/** Void colour of the fixed Marathon palette (`--mar-bg-void`). */
const VOID = '#0B0D0B'

/**
 * Style row injected into the served index.html <head>.
 *
 * - The boot plate is **recoloured, not removed**. The loading state then
 *   reads as "a dark screen", which is already the theme's own background,
 *   so the native screen has nothing left to show.
 * - Its content is hidden **only while it still carries the native spinner**
 *   (`[data-dsh-boot-spinner]` is DSH's own loading marker and is dropped
 *   from the card when the boot fails). A real plugin-load failure therefore
 *   still paints its "Failed to load plugins" card: the theme silences the
 *   animation without silencing the error.
 * - `html,body` carry the void colour as well, so the frame right after the
 *   plate is disposed cannot flash the default light canvas.
 */
const NATIVE_BOOT_CSS = [
  'html,body{background:' + VOID + '}',
  '[data-dsh-boot]:has([data-dsh-boot-spinner]){background:' + VOID + '!important}',
  '[data-dsh-boot]:has([data-dsh-boot-spinner]) > *{display:none!important}',
].join('')

/**
 * Host activation. The webserver emits `webserver/index-inject` on every
 * index render and each listener pushes its current rows, so the table is
 * read fresh per response and unloading the plugin withdraws the row.
 * @param ctx - Host context carrying the webserver event.
 */
async function apply(ctx) {
  ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'style', text: NATIVE_BOOT_CSS })
  })
}

module.exports = { name, apply, NATIVE_BOOT_CSS, VOID }
