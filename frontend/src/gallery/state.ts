import { create } from "zustand";

interface State {
    isOpen: boolean;

    setOpen(isOpen: boolean): void;
}

const useExamplesGallery = create<State>()(set => {
    return {
        isOpen: false,

        setOpen(isOpen: boolean) {
            set(() => ({ isOpen }));
        },
    };
});

export default useExamplesGallery;
