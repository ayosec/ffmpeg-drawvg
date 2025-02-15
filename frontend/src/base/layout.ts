import { create } from "zustand";

export enum Layout { Main, Vertical };

export interface AppLayout {
    layout: Layout;
    setLayout(layout: Layout): void;
}

function defaultLayout() {
    return window.matchMedia("(min-width: 800px)").matches
        ? Layout.Main
        : Layout.Vertical;
}

const useAppLayout = create<AppLayout>()((set, get) => {

    let resizeHandler: null|(() => void) = () => {
        const layout = defaultLayout();
        if (get().layout !== layout)
            set(() => ({ layout }));
    };

    window.addEventListener("resize", resizeHandler);

    return {
        layout: defaultLayout(),

        setLayout(layout: Layout) {
            set(() => {
                // After the first change from the user, stop the
                // resize listener.
                if (resizeHandler !== null) {
                    window.removeEventListener("resize", resizeHandler);
                    resizeHandler = null;
                }

                return { layout };
            });
        },
    };
});

export default useAppLayout;
