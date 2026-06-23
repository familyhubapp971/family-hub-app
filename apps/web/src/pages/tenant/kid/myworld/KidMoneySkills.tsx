import { Wallet } from 'lucide-react';

// FHS-376 — "Money Skills" explainer card for the kid. Pure presentation: tells
// the kid what their stars are worth and the three things they can do with them
// (spend / save / grow). The savings + invested numbers come from the parent.
export function KidMoneySkills({
  stickerBalance,
  savedStickers,
  savedCash,
  currency,
  planted,
  bonus,
  hasInvestments,
}: {
  stickerBalance: number;
  savedStickers: number;
  savedCash: number;
  currency: string;
  planted: number;
  bonus: number;
  hasInvestments: boolean;
}) {
  return (
    <section
      data-testid="kid-moneyskills"
      className="rounded-xl border-2 border-black bg-white p-6 shadow-neo-sm"
    >
      <h2 className="flex items-center gap-3 font-heading text-xl uppercase tracking-wide text-black">
        <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-black bg-green-200 shadow-neo-xs">
          <Wallet size={20} aria-hidden="true" />
        </span>
        Money Skills <span aria-hidden="true">🧠</span>
      </h2>

      <p className="mt-3 text-sm font-bold text-gray-700">
        You have {stickerBalance} stars! Every star is worth a little bit of real money. What will
        you do with them?
      </p>

      {/* Savings now + growing stars */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border-2 border-black bg-green-50 p-4">
          <h3 className="font-heading text-sm uppercase tracking-wide text-black">
            My Savings Now
          </h3>
          <dl className="mt-2 space-y-1 text-sm font-bold text-gray-700">
            <div className="flex items-center justify-between">
              <dt>Saved Stars</dt>
              <dd>{savedStickers} ⭐</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Worth</dt>
              <dd>
                {currency} {savedCash.toFixed(2)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border-2 border-black bg-purple-50 p-4">
          <h3 className="font-heading text-sm uppercase tracking-wide text-black">
            My Growing Stars <span aria-hidden="true">🌱</span>
          </h3>
          {hasInvestments ? (
            <dl className="mt-2 space-y-1 text-sm font-bold text-gray-700">
              <div className="flex items-center justify-between">
                <dt>Planted</dt>
                <dd>{planted} ⭐</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>✨ Bonus stars it made for you</dt>
                <dd className="text-green-600">+{bonus}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm font-bold text-gray-600">
              Plant some stars and watch them grow into more! 🌱
            </p>
          )}
        </div>
      </div>

      {/* Three things you can do */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border-2 border-black bg-pink-50 p-4">
          <p className="text-2xl" aria-hidden="true">
            🛍️
          </p>
          <h4 className="mt-2 font-heading text-sm uppercase tracking-wide text-black">
            Spend Now
          </h4>
          <p className="mt-1 text-xs font-bold text-gray-600">
            Use your stars for small treats in the Rewards Shop today!
          </p>
        </div>
        <div className="rounded-xl border-2 border-black bg-blue-50 p-4">
          <p className="text-2xl" aria-hidden="true">
            🐷
          </p>
          <h4 className="mt-2 font-heading text-sm uppercase tracking-wide text-black">Save Up</h4>
          <p className="mt-1 text-xs font-bold text-gray-600">
            Keep your stars safe. The more you save, the bigger rewards you can get later!
          </p>
        </div>
        <div className="rounded-xl border-2 border-black bg-green-50 p-4">
          <p className="text-2xl" aria-hidden="true">
            🌱
          </p>
          <h4 className="mt-2 font-heading text-sm uppercase tracking-wide text-black">
            Grow (Invest)
          </h4>
          <p className="mt-1 text-xs font-bold text-gray-600">
            Save your stars like seeds 🌱. Wait and they grow into more!
          </p>
        </div>
      </div>
    </section>
  );
}
