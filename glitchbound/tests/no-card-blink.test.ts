import { afterEach, describe, expect, it } from 'vitest';
import { cardImg } from '../src/platform/cardImg';
import { navigate, setPagePreloader } from '../src/router/router';

/**
 * Switching between Arcade, Party and Leaderboards made the cards blink (the owner, 2026-10-28): every card
 * popped in again one after another, and its picture filled in a frame after the card. From the second page
 * of a visit on, the page is marked: no entrance pop-ins (base.css), and the pictures in view decode first.
 */

afterEach(() => {
  delete document.documentElement.dataset.paged;
  setPagePreloader(() => undefined);
  window.history.replaceState(null, '', '/');
});

describe('page switches without blinking cards', () => {
  it('the first page loads pictures lazily and lets cards pop in; a switch marks the page', () => {
    expect(cardImg(false, true)).toEqual({ loading: 'lazy', decoding: 'async' });
    expect(cardImg(true, true)).toEqual({ loading: 'eager', decoding: 'async' });
    navigate('/party');
    expect(document.documentElement.dataset.paged).toBe('');
  });

  it('after a switch, a picture in view decodes before the page shows; the rest stay lazy', () => {
    navigate('/leaderboards');
    expect(cardImg(false, true)).toEqual({ loading: 'eager', decoding: 'sync' });
    expect(cardImg(true, false)).toEqual({ loading: 'lazy', decoding: 'async' });
  });

  it('a scroll within the same page is not a switch', () => {
    navigate('/#arcade');
    expect(document.documentElement.dataset.paged).toBeUndefined();
  });
});
