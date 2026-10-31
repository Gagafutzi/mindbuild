/**
 * Where the app opens.
 *
 * The intro screen's "don't show again" was saved and never read: the empty
 * path redirected to the intro unconditionally, so it came back on every
 * visit however often it was dismissed. The choice is read here, and the
 * route on the empty path asks this where to go. The side menu's link to the
 * intro still opens it on purpose.
 */

import { EnumScreens } from "../constants/game.constants";
import { LS_DONT_SHOW } from "../constants/local-storage.constants";
import { WORLD_PINNED } from "./trainer.utils";

export function landingScreen(): EnumScreens {
    /* The hub's Composed World trainer starts on its item; Syllogimous's intro is not its intro. */
    if (WORLD_PINNED) return EnumScreens.Start;
    try {
        return localStorage.getItem(LS_DONT_SHOW + EnumScreens.Intro) ? EnumScreens.Start : EnumScreens.Intro;
    } catch {
        /* Private mode: nothing was saved, so nothing was declined. */
        return EnumScreens.Intro;
    }
}
