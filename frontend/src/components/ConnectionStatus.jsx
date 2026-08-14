const ConnectionStatus = ({ connected }) => {
  return (
    <div className="flex items-center gap-2 rounded-full border border-teal-700/10 bg-white/60 px-3 py-2 text-xs font-medium text-slate-600 backdrop-blur">

      <span
        className={`h-2 w-2 rounded-full ${
          connected
            ? "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.1)]"
            : "bg-slate-300"
        }`}
      />

      {connected ? "Connected" : "Connecting..."}

    </div>
  );
};

export default ConnectionStatus;