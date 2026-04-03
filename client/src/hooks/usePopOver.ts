import { useState, useCallback } from "react";

interface PopoverState {
  userId: number;
  username: string;
  el: HTMLElement;
}

export function usePopover() {
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const openPopover = useCallback(
    (userId: number, username: string, el: HTMLElement) => {
      setPopover({ userId, username, el });
    },
    [],
  );

  const closePopover = useCallback(() => {
    setPopover(null);
  }, []);

  return { popover, openPopover, closePopover };
}
