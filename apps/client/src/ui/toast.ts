// Short notices at the top of the screen (M8): report results, "Copied!" / "Loaded!" for keybind codes and a lost
// connection without a menu to return to (the original created small toasts next to the clicked element, survev
// ui/menu.ts createToast). Each one fades out after a few seconds.
import "./settings.css";

const DEFAULT_MS = 4000;
const FADE_MS = 400;

let container: HTMLDivElement | null = null;

/** Shows `text`; `error` notices are red. Returns the toast element. */
export function showToast(text: string, opts: { error?: boolean; durationMs?: number } = {}): HTMLDivElement {
    if (!container?.isConnected) {
        container = document.createElement("div");
        container.id = "ui-toasts";
        document.body.append(container);
    }
    const toast = document.createElement("div");
    toast.className = `ui-toast${opts.error ? " ui-toast-error" : ""}`;
    toast.textContent = text;
    container.append(toast);
    const ms = opts.durationMs ?? DEFAULT_MS;
    setTimeout(() => toast.classList.add("ui-toast-out"), ms);
    setTimeout(() => toast.remove(), ms + FADE_MS);
    return toast;
}
