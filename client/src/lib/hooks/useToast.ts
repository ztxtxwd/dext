"use client";

import { toast as sonnerToast } from "sonner";

type ToastOptions = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
};

// Adapter function to maintain compatibility with existing toast API
function toast({
  title,
  description,
  variant = "default",
  duration,
}: ToastOptions) {
  const message = title || "";

  switch (variant) {
    case "destructive":
      return sonnerToast.error(message, {
        description,
        duration,
      });
    case "success":
      return sonnerToast.success(message, {
        description,
        duration,
      });
    default:
      return sonnerToast(message, {
        description,
        duration,
      });
  }
}

// For backward compatibility, also export a simple function with just message
toast.success = (
  message: string,
  options?: { description?: string; duration?: number },
) => {
  return sonnerToast.success(message, options);
};

toast.error = (
  message: string,
  options?: { description?: string; duration?: number },
) => {
  return sonnerToast.error(message, options);
};

toast.info = (
  message: string,
  options?: { description?: string; duration?: number },
) => {
  return sonnerToast.info(message, options);
};

toast.warning = (
  message: string,
  options?: { description?: string; duration?: number },
) => {
  return sonnerToast.warning(message, options);
};

function useToast() {
  return {
    toast,
    dismiss: () => sonnerToast.dismiss(),
    toasts: [], // sonner doesn't expose active toasts in the same way
  };
}

export { useToast, toast };
