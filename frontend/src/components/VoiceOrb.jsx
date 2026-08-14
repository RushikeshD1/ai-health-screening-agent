const VoiceOrb = ({
  isCallActive,
  isListening,
}) => {
  return (
    <div
      className={`
        relative grid h-36 w-36 place-items-center rounded-full
        bg-[radial-gradient(circle_at_35%_30%,#9be2d7,#27a99b_45%,#087f73_100%)]
        shadow-[0_0_0_18px_rgba(38,169,155,0.07),0_0_0_38px_rgba(38,169,155,0.035),0_25px_60px_rgba(8,127,115,0.22)]
        transition-all duration-500
        sm:h-40 sm:w-40
        ${
          isListening
            ? "voice-listening shadow-[0_0_0_24px_rgba(38,169,155,0.1),0_0_0_50px_rgba(38,169,155,0.04),0_25px_70px_rgba(8,127,115,0.3)]"
            : isCallActive
            ? "voice-breathe"
            : ""
        }
      `}
    >
      <div className="grid h-24 w-24 place-items-center rounded-full border border-white/30 bg-white/10 text-3xl text-white backdrop-blur-sm">
        ✦
      </div>
    </div>
  );
};

export default VoiceOrb;