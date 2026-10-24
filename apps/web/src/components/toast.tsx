import { Check } from "lucide-react";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

// How long a toast stays on screen.
const TOAST_MS = 3000;

const ToastContext = createContext<(message: string) => void>(() => {});

// One short message at the bottom of the screen ("Share deleted"), gone after
// 3 s. role="status" has screen readers read it without moving the focus.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <ToastContext value={setMessage}>
      {children}
      <div
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-floating z-20 flex justify-center px-4"
      >
        {message && (
          <p className="flex items-center gap-2 rounded-full border border-border bg-surface-raised px-5 py-2.5 text-sm font-medium text-status-ok shadow-lg">
            <Check aria-hidden className="size-4" />
            {message}
          </p>
        )}
      </div>
    </ToastContext>
  );
}

// Shows a toast: `const toast = useToast(); toast("Share deleted")`.
export function useToast() {
  return useContext(ToastContext);
}
