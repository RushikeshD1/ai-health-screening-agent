import ConnectionStatus from "./ConnectionStatus";

const Header = ({ connected }) => {
  return (
    <header className="fixed top-0 left-0 z-50 flex w-full items-center justify-between bg-[#f5fbf9]/60 px-6 py-5 backdrop-blur-xl sm:px-10 lg:px-20">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-700 text-lg text-white shadow-lg shadow-teal-700/20">
          ✦
        </div>

        <div>
          <h2 className="font-semibold tracking-tight text-teal-950">Niva</h2>

          <p className="text-[11px] text-slate-500">Health companion</p>
        </div>
      </div>

      <ConnectionStatus connected={connected} />
    </header>
  );
};

export default Header;
