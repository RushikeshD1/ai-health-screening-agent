const CallButton = ({
  isCallActive,
  connected,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={!connected}
      className={`
        mt-7 flex h-14 min-w-44 items-center justify-center
        gap-2 rounded-full px-7
        text-sm font-semibold text-white
        transition-all duration-200
        active:scale-95
        disabled:cursor-not-allowed
        disabled:opacity-50

        ${
          isCallActive
            ? "bg-red-500 shadow-lg shadow-red-500/20 hover:bg-red-600"
            : "bg-teal-700 shadow-lg shadow-teal-700/25 hover:-translate-y-0.5 hover:bg-teal-800"
        }
      `}
    >
      <span className="text-xs">
        {isCallActive ? "■" : "✦"}
      </span>

      {isCallActive ? "End Call" : "Start Call"}
    </button>
  );
};

export default CallButton;