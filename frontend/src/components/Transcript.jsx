const Transcript = ({
  transcript,
  aiResponse,
  isListening,
}) => {
  return (
    <section className="mx-auto mt-14 w-full max-w-2xl text-left">

      <div className="flex items-center justify-between border-b border-teal-950/10 pb-3">
        <span className="text-[10px] font-bold tracking-[0.18em] text-slate-500">
          YOUR WORDS
        </span>

        {isListening && (
          <span className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-teal-700">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
            LIVE
          </span>
        )}
      </div>

      <div
        className={`
          min-h-28 px-1 py-6
          text-lg leading-8
          transition-colors duration-300
          ${
            transcript
              ? "text-teal-950"
              : "text-slate-400"
          }
        `}
      >
        {transcript ||
          (isListening
            ? "Listening to you..."
            : "Your words will appear here while you speak.")}
      </div>

      {aiResponse && (
        <div className="mt-6 border-t border-teal-950/10 pt-5">
          <span className="text-[10px] font-bold tracking-[0.18em] text-teal-700">
            AI RESPONSE
          </span>

          <div className="mt-3 text-lg leading-8 text-teal-950">
            {aiResponse}
          </div>
        </div>
      )}

    </section>
  );
};

export default Transcript;