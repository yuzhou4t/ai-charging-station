export default function BackgroundMesh() {
  return (
    <>
      {/* Base Background container with Grid and Blobs */}
      <div className="fixed inset-0 z-[-2] overflow-hidden bg-[#F3F3F0] dark:bg-[#0A0A0B] pointer-events-none transition-colors duration-500">

        {/* Cinematic Atmospheric Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-200/30 dark:bg-indigo-900/30 blur-[100px] transition-colors duration-500 animate-[mesh-pulse_15s_ease-in-out_infinite_alternate]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-orange-100/30 dark:bg-fuchsia-900/20 blur-[120px] transition-colors duration-500 animate-[mesh-pulse_20s_ease-in-out_infinite_alternate_reverse]" />
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-rose-200/30 dark:bg-cyan-900/20 blur-[80px] transition-colors duration-500 animate-[mesh-pulse_10s_ease-in-out_infinite_alternate]" />
      </div>

      {/* Global SVG Film Grain Overlay — optimized for performance */}
      <div className="pointer-events-none fixed inset-0 z-50 h-full w-full opacity-20 dark:opacity-15 mix-blend-overlay transition-opacity duration-500">
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
      </div>
    </>
  )
}
