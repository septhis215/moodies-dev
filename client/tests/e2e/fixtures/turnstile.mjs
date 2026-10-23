/** Deterministic third-party widget fixture; never included in the application. */
export async function installMockTurnstile(
  context,
  { failFirstScript = false } = {},
) {
  let scriptRequests = 0;
  await context.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js*",
    async (route) => {
      scriptRequests++;
      if (failFirstScript && scriptRequests === 1) return route.abort("failed");
      return route.fulfill({
        contentType: "application/javascript",
        body: `
      (() => {
        const callbackName = new URL(document.currentScript.src).searchParams.get('onload');
        let sequence = 0;
        const widgets = new Map();
        window.turnstile = {
          ready(callback) { callback(); },
          render(target, options) {
            const id = 'fixture-' + ++sequence;
            const element = typeof target === 'string' ? document.querySelector(target) : target;
            const marker = document.createElement('span');
            marker.dataset.turnstileFixture = id;
            marker.textContent = 'Security check fixture';
            element.appendChild(marker);
            widgets.set(id, marker);
            setTimeout(() => {
              if (!marker.isConnected) return;
              const mode = window.__turnstileTestMode || 'success';
              if (mode === 'error') options['error-callback']?.('fixture-error');
              else if (mode !== 'hang') options.callback('fixture:' + options.action + ':' + crypto.randomUUID());
            }, 20);
            return id;
          },
          remove(id) { widgets.get(id)?.remove(); widgets.delete(id); },
          reset() {}, execute() {}, isExpired() { return false; }, getResponse() { return ''; }
        };
        window[callbackName]?.();
      })();
    `,
      });
    },
  );
  return { scriptRequests: () => scriptRequests };
}
