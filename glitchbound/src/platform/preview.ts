/** Where Admin › Home page puts its unpublished draft for the preview frame (pages/admin/HomeSection.tsx). */
export const PREVIEW_KEY = 'glitchbound.preview';

/**
 * This page is the admin's preview of an unpublished home page (/?preview, in a frame of the admin): it shows
 * the draft from PREVIEW_KEY and follows its changes; it never fetches, stores or reports the real catalog,
 * and skips the entrance.
 */
export const previewing = typeof location !== 'undefined' && new URLSearchParams(location.search).has('preview');
