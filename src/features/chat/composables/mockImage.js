const DEFAULT_MOCK_IMAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720" fill="none">
  <defs>
    <linearGradient id="mockBg" x1="120" y1="80" x2="840" y2="640" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#95D8FF"/>
      <stop offset="1" stop-color="#6F8CFF"/>
    </linearGradient>
    <linearGradient id="mockCard" x1="200" y1="140" x2="760" y2="620" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="rgba(255,255,255,0.62)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0.32)"/>
    </linearGradient>
  </defs>
  <rect width="960" height="720" fill="url(#mockBg)"/>
  <rect x="120" y="110" width="720" height="500" rx="46" fill="url(#mockCard)" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
  <path d="M182 520L330 378L428 472L570 334L778 562H182V520Z" fill="rgba(255,255,255,0.72)"/>
  <circle cx="665" cy="250" r="54" fill="rgba(255,255,255,0.82)"/>
  <rect x="372" y="300" width="216" height="132" rx="30" fill="rgba(0,0,0,0.42)"/>
  <rect x="408" y="270" width="64" height="28" rx="12" fill="rgba(0,0,0,0.42)"/>
  <circle cx="482" cy="366" r="36" fill="rgba(255,255,255,0.94)"/>
  <circle cx="782" cy="552" r="58" fill="rgba(0,0,0,0.58)"/>
  <path d="M778 523C771 523 764.9 527.5 762.6 534.2H748C740.3 534.2 734 540.5 734 548.2V568.2C734 575.9 740.3 582.2 748 582.2H808C815.7 582.2 822 575.9 822 568.2V548.2C822 540.5 815.7 534.2 808 534.2H793.4C791.1 527.5 785 523 778 523ZM778 573.2C765.9 573.2 756 563.3 756 551.2C756 539.1 765.9 529.2 778 529.2C790.1 529.2 800 539.1 800 551.2C800 563.3 790.1 573.2 778 573.2Z" fill="white"/>
  <text x="480" y="642" text-anchor="middle" fill="rgba(255,255,255,0.93)" font-size="34" font-family="Arial, sans-serif" letter-spacing="4">MOCK PHOTO</text>
</svg>`

export const DEFAULT_MOCK_IMAGE_PLACEHOLDER = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(DEFAULT_MOCK_IMAGE_SVG)}`

export function resolveMockImagePlaceholder(value) {
  const candidate = String(value || '').trim()
  return candidate || DEFAULT_MOCK_IMAGE_PLACEHOLDER
}
