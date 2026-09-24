import * as RadixToast from "@radix-ui/react-toast";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { ToastMessage, useToastStore } from "@/stores/toast";

export function Toast({ toast }: { toast: ToastMessage }) {
  const removeToast = useToastStore((s) => s.removeToast);

  const icon =
    toast.type === "success" ? <CheckCircle2 className="text-green-500" /> :
    toast.type === "error" ? <XCircle className="text-red-500" /> :
    <Info className="text-blue-500" />;

  const handleClose = () => {
    removeToast(toast.id);
  };

  return (
    <RadixToast.Root
      open={true}
      onOpenChange={(open) => !open && removeToast(toast.id)}
      className="bg-white dark:bg-neutral-900 shadow-lg rounded-xl p-4 flex items-start gap-3 border border-gray-200 data-[state=open]:animate-slideIn data-[state=closed]:animate-slideOut cursor-pointer relative"
      onClick={handleClose}
    >
      {icon}
      <div className="flex-1">
        <RadixToast.Title className="font-semibold">
          {toast.title}
        </RadixToast.Title>
        {toast.description && (
          <RadixToast.Description className="text-sm text-muted-foreground">
            {toast.description}
          </RadixToast.Description>
        )}
      </div>
      <RadixToast.Close
        className="absolute top-2 right-2 text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
      >
        <X size={16} />
      </RadixToast.Close>
    </RadixToast.Root>
  );
}