import React, { useState, useEffect, useRef, FC } from 'react';
import { twMerge } from 'tailwind-merge';
import { useSidebar } from '../sidebar/SidebarProvider';
import { Tooltip } from 'radix-ui';

type DropdownProps = {
  children: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  buttonContent: React.ReactNode;
  buttonTooltip: string;
};

const Dropdown:FC<DropdownProps> = ({ children, className, buttonClassName, buttonTooltip, buttonContent }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { isCollapse } = useSidebar();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={dropdownRef} className={twMerge('relative', className)}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button onClick={toggleDropdown} className={buttonClassName}>
            {buttonContent}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          {
            isCollapse &&
            <Tooltip.Content
              className="z-tooltip select-none rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-black px-2 py-1 text-sm"
              side="right"
              sideOffset={5}
            > <>
                <Tooltip.Arrow className="fill-gray-900 dark:fill-gray-100" />
                {buttonTooltip}
              </>
            </Tooltip.Content>
          }
        </Tooltip.Portal>
      </Tooltip.Root>
      {isOpen && (
        <div
          className={twMerge(isCollapse ? "left-[calc(100%+8px)] -top-1" : " top-[calc(100%+4px)] ", "absolute z-dropdown w-[228px] bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border dark:border-none rounded-lg py-2 flex flex-col shadow-lg mt-1 max-h-[calc(100dvh-160px)]")}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export { Dropdown };
