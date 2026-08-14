const MicButton = ({
  isCallActive,
  isListening,
  onMicDown,
  onMicUp,
}) => {
  if (!isCallActive) {
    return null;
  }

  return (
    <button
      onMouseDown={onMicDown}
      onMouseUp={onMicUp}
      onMouseLeave={onMicUp}
      onTouchStart={onMicDown}
      onTouchEnd={onMicUp}
      className={`
  mt-3 flex h-12 items-center gap-2
  rounded-full border px-5
  text-sm font-semibold
  transition-all duration-200
  cursor-pointer

  ${
    isListening
      ? "scale-105 border-emerald-700 bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
      : "border-teal-700/15 bg-white/70 text-teal-700 hover:bg-blue-500"
  }
`}
    >
      <span>🎙</span>

      {isListening
        ? "Release to send"
        : "Hold to speak"}
    </button>
  );
};

export default MicButton;