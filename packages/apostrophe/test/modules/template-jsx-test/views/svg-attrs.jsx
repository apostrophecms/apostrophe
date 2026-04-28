// Verifies that camelCase SVG presentation attributes are emitted in
// the kebab-case form expected by browsers parsing text/html, and that
// natively camelCase SVG attributes (viewBox, preserveAspectRatio) are
// preserved.

export default function () {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="4 2"
      strokeOpacity="0.5"
      fillRule="evenodd"
      clipRule="evenodd"
      pointerEvents="none"
      textAnchor="middle"
    >
      <path d="M0 0L24 24" />
    </svg>
  );
}
