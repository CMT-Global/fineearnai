import { toast } from "sonner";

export const handleError = (error: any, context?: string) => {
  console.error(`Error${context ? ` in ${context}` : ""}:`, error);

  let message = "An unexpected error occurred. Please try again.";

  if (error?.message) {
    // Handle specific error types
    if (error.message.includes("JWT")) {
      message = "Your session has expired. Please log in again.";
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } else if (error.message.includes("network") || error.message.includes("fetch")) {
      message = "Network error. Please check your connection and try again.";
    } else if (error.message.includes("permission") || error.message.includes("policy")) {
      message = "You don't have permission to perform this action.";
    } else if (error.message.includes("not found")) {
      message = "The requested resource was not found.";
    } else {
      message = error.message;
    }
  }

  toast.error(message);
  return message;
};

export const handleSuccess = (message: string) => {
  toast.success(message);
};

export const handleInfo = (message: string) => {
  toast.info(message);
};

export const handleWarning = (message: string) => {
  toast.warning(message);
};
