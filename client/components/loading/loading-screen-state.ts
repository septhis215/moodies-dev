/** Page fallbacks may overlap as a route streams or the session bootstraps. */
export function createLoadingScreenState(onChange: (visible: boolean) => void) {
  const pending = new Set<symbol>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function cancelDismissal() {
    clearTimeout(timer);
    timer = undefined;
  }

  return {
    register() {
      cancelDismissal();
      const token = Symbol("page loading");
      pending.add(token);
      onChange(true);
      return () => {
        if (!pending.delete(token) || pending.size > 0) return;
        // Keep the ready page mounted underneath for a short settling period.
        timer = setTimeout(() => {
          timer = undefined;
          if (pending.size === 0) onChange(false);
        }, 500);
      };
    },
    dispose() {
      cancelDismissal();
      pending.clear();
    },
  };
}
