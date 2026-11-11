import { useLayoutEffect, useRef, useState } from 'react';

/**
 * A hero's picture standing on its spot: a lobby's dais, a class's card. Its box has the picture's own shape from the
 * first frame (every such picture is one shape: render3d/portrait.ts `dollPicture`), so where it stands never waits
 * on the picture coming in; and it is shown only once the picture is in, so it steps onto its spot whole.
 *
 * It used to be a bare image, as wide as its picture and set over its spot by half that width. A picture that had not
 * come in yet has no width, so for a moment (a phone takes one to read a picture this size) the hero stood beside the
 * spot, not on it.
 */
export function Doll({ src, className, alt = '' }: { src: string; className: string; alt?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [isIn, setIn] = useState(false);
  // (a picture the browser already holds is in at once: no wait, no flicker)
  useLayoutEffect(() => {
    const i = ref.current;
    if (i && i.complete && i.naturalWidth > 0) setIn(true);
  }, []);
  // (a picture that can't be had is shown as it is, an empty box, not held back forever)
  return <img ref={ref} className={`rb-dollpic ${className}${isIn ? ' is-in' : ''}`} src={src} alt={alt} draggable={false} onLoad={() => setIn(true)} onError={() => setIn(true)} />;
}
