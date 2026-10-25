/**
 * The intro screen's "don't show again", read where the app opens.
 *
 * It was written by the intro and read by nothing: the empty path redirected
 * to the intro whatever had been chosen, so the screen came back every visit.
 */

import { equal, test } from "./harness";
import { EnumScreens } from "../src/app/syllogimous/constants/game.constants";
import { LS_DONT_SHOW } from "../src/app/syllogimous/constants/local-storage.constants";
import { landingScreen } from "../src/app/syllogimous/utils/landing.utils";

test("the app opens on the intro until it is dismissed for good, and never on it after", () => {
    localStorage.clear();
    equal(landingScreen(), EnumScreens.Intro, "a first visit does not open on the intro");
    /* What the intro's own checkbox writes. */
    localStorage.setItem(LS_DONT_SHOW + EnumScreens.Intro, "1");
    equal(landingScreen(), EnumScreens.Start, "the intro came back after don't show again");
    localStorage.clear();
});
