/**
 * The game's event bus. Actions publish what happened; the progress tracker, the wish system
 * and the UI subscribe. See game/progress.js for the subscribers.
 *
 * Events and payloads:
 *   'fishing:cast'    {}
 *   'fishing:catch'   { fish, quantity }
 *   'item:gathered'   { item, quantity }
 *   'goat:milked'     {}
 *   'cat:fed'         { catId, taste, discoveredFavourite }
 *   'cat:petted'      { catId, success }
 *   'cat:played'      { catId, favourite }
 *   'cat:coaxed'      { catId }
 *   'cat:stroked'     { catId }   (stroked to its daily content in the village)
 *   'photo:taken'     { catId, isNew }
 *   'wish:granted'    { catId, kind }
 */
import { createEventBus } from "../core/events.js";

export const gameEvents = createEventBus();
