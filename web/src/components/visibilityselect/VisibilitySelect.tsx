import * as Select from "@radix-ui/react-select";
import { Check, Globe, Building, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function VisibilitySelect({ value, onChange }: any) {
  const { t } = useTranslation();

  const items = [
    { value: "public", label: t("visibility.public"), icon: Globe },
    { value: "workspace", label: t("visibility.workspace"), icon: Building },
    { value: "private", label: t("visibility.private"), icon: Lock },
  ];

  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="px-2 py-1 rounded-lg  dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 cursor-pointer ">
        <Select.Value />
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          side="bottom"
          align="start"
          sideOffset={6}
          className="overflow-hidden w-60 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl shadow-xl z-popover data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <Select.Viewport className="p-1">
            {items.map((item) => (
              <Select.Item
                key={item.value}
                value={item.value}
                className="relative flex items-center p-3 rounded-lg text-sm outline-none cursor-pointer select-none data-[highlighted]:bg-neutral-100 dark:data-[highlighted]:bg-neutral-800 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                <Select.ItemText>
                  <div className="flex items-center gap-6 w-full">
                    <item.icon size={16} />
                    {item.label}
                  </div>
                </Select.ItemText>
                <Select.ItemIndicator className="absolute right-2">
                  <Check size={16} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}