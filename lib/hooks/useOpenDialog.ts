import { Dispatch, SetStateAction, useState } from "react";

export interface IDialogState {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  openDialog: () => void;
  closeDialog: () => void;
}

export function useDialogState(defaultOpen?: boolean): IDialogState {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);

  const openDialog = () => {
    setIsOpen(true);
  };

  const closeDialog = () => {
    setIsOpen(false);
  };

  return { isOpen, setIsOpen, openDialog, closeDialog };
}
