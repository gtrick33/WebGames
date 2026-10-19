/** The Whatsit: a brown-paper parcel peeking out from under its lid, with a mood in its eyes. */
export type Mood = 'idle' | 'yes' | 'no' | 'think';

export function Parcel({ mood, className = '' }: { mood: Mood; className?: string }) {
  return (
    <svg className={`whz-parcel is-${mood} ${className}`} viewBox="0 0 80 80" aria-hidden="true">
      <ellipse cx="40" cy="75" rx="27" ry="3.5" className="whz-parcel-shadow" />
      <rect x="10" y="38" width="60" height="34" rx="5" className="whz-parcel-box" />
      <rect x="36" y="38" width="8" height="34" className="whz-parcel-string" />
      <rect x="12" y="29" width="56" height="12" rx="3" className="whz-parcel-dark" />
      {mood === 'yes' ? (
        <>
          <path d="M23 37 Q28 31 33 37" className="whz-parcel-happy" />
          <path d="M47 37 Q52 31 57 37" className="whz-parcel-happy" />
        </>
      ) : mood === 'no' ? (
        <>
          <path d="M23 35 L33 36" className="whz-parcel-grump" />
          <path d="M47 36 L57 35" className="whz-parcel-grump" />
        </>
      ) : (
        <>
          <ellipse cx="28" cy="35" rx="5.5" ry="4.2" className="whz-parcel-eye" />
          <ellipse cx="52" cy="35" rx="5.5" ry="4.2" className="whz-parcel-eye" />
          <circle cx={mood === 'think' ? 30 : 28.6} cy={mood === 'think' ? 33.4 : 35.4} r="2.3" className="whz-parcel-pupil" />
          <circle cx={mood === 'think' ? 54 : 52.6} cy={mood === 'think' ? 33.4 : 35.4} r="2.3" className="whz-parcel-pupil" />
        </>
      )}
      <g className="whz-parcel-lid">
        <rect x="6" y="15" width="68" height="15" rx="4" className="whz-parcel-top" />
        <rect x="36" y="15" width="8" height="15" className="whz-parcel-string" />
        <path d="M40 15 C30 2 22 8 30 14 Z" className="whz-parcel-bow" />
        <path d="M40 15 C50 2 58 8 50 14 Z" className="whz-parcel-bow" />
        <circle cx="40" cy="14.5" r="3.4" className="whz-parcel-bow" />
      </g>
      <circle cx="58" cy="58" r="7.5" className="whz-parcel-tag" />
      <text x="58" y="62" textAnchor="middle" className="whz-parcel-q">
        ?
      </text>
    </svg>
  );
}
