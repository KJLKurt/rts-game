export class UpdateUnavailableError extends Error {
  constructor() { super("The offered update is no longer waiting."); }
}

export async function setupPWA(
  onUpdate: (apply: () => Promise<void>) => void,
  beforeUpdate: () => Promise<void>,
) {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  try {
    const registration = await navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL}sw.js`,
      { scope: import.meta.env.BASE_URL },
    );
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) location.reload();
    });
    const offer = () => {
      if (!registration.waiting) return;
      onUpdate(async () => {
        await beforeUpdate();
        const waiting = registration.waiting;
        if (!waiting) throw new UpdateUnavailableError();
        reloading = true;
        try { waiting.postMessage({ type: "ACTIVATE_UPDATE" }); }
        catch (error) { reloading = false; throw error; }
      });
    };
    offer();
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller)
          offer();
      });
    });
  } catch (error) {
    console.warn("Offline cache unavailable", error);
  }
}
