"use client";

import { useState, useMemo } from "react";
import type { Trade, Account, TradeImage } from "@/lib/types";
// TradeImage used in imagesMap state below
import { formatKRW, formatRate, lastEntryDate, planStatus } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import TradeImageZone from "./TradeImageZone";
import TradeChart from "./TradeChart";

const COLOR_PALETTE = [
  { border: "border-l-blue-400", badge: "bg-blue-100 text-blue-700" },
  { border: "border-l-emerald-400", badge: "bg-emerald-100 text-emerald-700" },
  { border: "border-l-violet-400", badge: "bg-violet-100 text-violet-700" },
  { border: "border-l-orange-400", badge: "bg-orange-100 text-orange-700" },
  { border: "border-l-pink-400", badge: "bg-pink-100 text-pink-700" },
  { border: "border-l-teal-400", badge: "bg-teal-100 text-teal-700" },
  { border: "border-l-amber-400", badge: "bg-amber-100 text-amber-700" },
  { border: "border-l-rose-400", badge: "bg-rose-100 text-rose-700" },
] as const;

const TYPE_STYLE: Record<string, string> = {
  코스피: "bg-blue-50 text-blue-600 border-blue-200",
  코스닥: "bg-green-50 text-green-600 border-green-200",
  ETF: "bg-purple-50 text-purple-600 border-purple-200",
};

const PLAN_TONE_STYLE: Record<"neutral" | "good" | "bad", string> = {
  neutral: "border-gray-200 text-gray-500 bg-white",
  good: "border-green-200 text-green-600 bg-green-50",
  bad: "border-orange-200 text-orange-600 bg-orange-50",
};

interface Props {
  trades: Trade[];
  accounts: Account[];
  symbolTypeMap?: Record<string, string>;
  priceMap?: Record<string, number>;
  onEdit: (trade: Trade) => void;
  onDelete: (trade: Trade) => void;
}

type EntryRow = {
  date: string;
  type: "매수" | "매도";
  price: number;
  quantity: number;
};

export default function TradeHistory({
  trades,
  accounts,
  symbolTypeMap = {},
  priceMap = {},
  onEdit,
  onDelete,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [simPrices, setSimPrices] = useState<Record<string, string>>({});
  const [imagesMap, setImagesMap] = useState<Record<string, TradeImage[]>>({});
  const [showCompleted, setShowCompleted] = useState<Set<string>>(new Set());
  const [priceInputs, setPriceInputs] = useState<Record<string, { target: string; stop: string }>>({});
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());

  function getPriceInput(trade: Trade) {
    return priceInputs[trade.id] ?? {
      target: trade.targetPrice ? String(Math.round(trade.targetPrice)) : '',
      stop: trade.stopLossPrice ? String(Math.round(trade.stopLossPrice)) : '',
    }
  }

  function updatePriceInput(tradeId: string, field: 'target' | 'stop', value: string) {
    setPriceInputs(prev => ({
      ...prev,
      [tradeId]: { ...(prev[tradeId] ?? { target: '', stop: '' }), [field]: value },
    }))
  }

  async function savePrices(trade: Trade) {
    const input = getPriceInput(trade)
    await apiFetch(`/api/trades/${trade.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetPrice: input.target ? Number(input.target) : null,
        stopLossPrice: input.stop ? Number(input.stop) : null,
      }),
    })
    setSavedSet(prev => new Set([...prev, trade.id]))
    setTimeout(() => setSavedSet(prev => { const n = new Set(prev); n.delete(trade.id); return n }), 2000)
  }

  function toggleShowCompleted(accountId: string) {
    setShowCompleted(prev => {
      const next = new Set(prev)
      next.has(accountId) ? next.delete(accountId) : next.add(accountId)
      return next
    })
  }

  const symbolInfoMap = useMemo(() => {
    const bySymbol: Record<string, Trade[]> = {};
    trades.forEach((t) => {
      (bySymbol[t.symbol] ??= []).push(t);
    });

    const colorMap: Record<string, (typeof COLOR_PALETTE)[number]> = {};
    let colorIdx = 0;
    Object.entries(bySymbol).forEach(([symbol, list]) => {
      if (list.length >= 2) {
        colorMap[symbol] = COLOR_PALETTE[colorIdx++ % COLOR_PALETTE.length];
      }
    });

    const seqMap: Record<string, { seq: number; total: number }> = {};
    Object.entries(bySymbol).forEach(([, list]) => {
      if (list.length < 2) return;
      const sorted = [...list].sort((a, b) =>
        (a.buyEntries[0]?.date ?? "").localeCompare(
          b.buyEntries[0]?.date ?? "",
        ),
      );
      sorted.forEach((t, i) => {
        seqMap[t.id] = { seq: i + 1, total: sorted.length };
      });
    });

    return { colorMap, seqMap };
  }, [trades]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function calcSim(trade: Trade, priceStr: string) {
    const price = Number(priceStr.replace(/,/g, ""));
    if (!price || price <= 0) return null;
    const profit = (price - trade.avgBuyPrice) * trade.remainingQuantity;
    const rate = (profit / (trade.avgBuyPrice * trade.remainingQuantity)) * 100;
    return { profit, rate };
  }

  if (trades.length === 0)
    return (
      <p className="text-center text-gray-400 py-16 text-sm">
        거래 기록이 없습니다
        <br />새 거래를 입력해보세요
      </p>
    );

  const accountOrder = accounts.map((a) => a.id);
  const byAccount = trades.reduce<Record<string, Trade[]>>((acc, t) => {
    (acc[t.accountId] ??= []).push(t);
    return acc;
  }, {});
  const accountIds = [
    ...accountOrder.filter((id) => byAccount[id]),
    ...Object.keys(byAccount).filter((id) => !accountOrder.includes(id)),
  ];

  return (
    <div className="space-y-6">
      {accountIds.map((accountId) => {
        const account = accounts.find((a) => a.id === accountId);
        const accountTrades = [...byAccount[accountId]].sort((a, b) => {
          if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1
          return lastEntryDate(b).localeCompare(lastEntryDate(a))
        });

        return (
          <div key={accountId}>
            {/* 계좌 헤더 */}
            <div className="flex items-center gap-2 mb-3 pb-1 border-b-2 border-gray-200">
              <span className="font-semibold text-gray-700">
                {account
                  ? account.nickname ||
                    `${account.broker} ${account.accountNumber}`
                  : "알 수 없는 계좌"}
              </span>
              <span className="text-xs text-gray-400">
                {accountTrades.length}건
              </span>
              {(() => {
                const holdingCount = accountTrades.filter(t => !t.isCompleted).length
                const completedCount = accountTrades.length - holdingCount
                return (
                  <>
                    {holdingCount > 0 && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                        보유 {holdingCount}
                      </span>
                    )}
                    {completedCount > 0 && (
                      <button
                        onClick={() => toggleShowCompleted(accountId)}
                        className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${showCompleted.has(accountId) ? 'bg-gray-200 text-gray-500 border-gray-300' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'}`}
                      >
                        완료 {completedCount} {showCompleted.has(accountId) ? '숨기기' : '표시'}
                      </button>
                    )}
                  </>
                )
              })()}
            </div>

            <div className="space-y-3">
              {accountTrades.filter(t => !(!showCompleted.has(accountId) && t.isCompleted)).map((trade) => {
                const entries: EntryRow[] = [
                  ...trade.buyEntries.map((e) => ({
                    date: e.date,
                    type: "매수" as const,
                    price: e.price,
                    quantity: e.quantity,
                  })),
                  ...trade.sellEntries.map((e) => ({
                    date: e.date,
                    type: "매도" as const,
                    price: e.price,
                    quantity: e.quantity,
                  })),
                ].sort((a, b) => a.date.localeCompare(b.date));

                const isPos = trade.profitAmount >= 0;

                const holdingColor =
                  trade.holdingDays <= 7
                    ? "bg-green-100 text-green-700"
                    : trade.holdingDays <= 30
                      ? "bg-blue-100 text-blue-700"
                      : trade.holdingDays <= 90
                        ? "bg-orange-100 text-orange-700"
                        : "bg-red-100 text-red-700";

                const isExpanded = expanded.has(trade.id);
                const symbolColor = symbolInfoMap.colorMap[trade.symbol];
                const symbolSeq = symbolInfoMap.seqMap[trade.id];

                return (
                  <div
                    key={trade.id}
                    className={`rounded-lg overflow-hidden border bg-white ${symbolColor ? `border-l-4 ${symbolColor.border}` : ""}`}
                  >
                    {/* 종목 헤더 */}
                    <div
                      className={`flex items-center justify-between px-4 py-2 cursor-pointer select-none ${trade.isCompleted ? "bg-gray-200 opacity-60" : "bg-gray-50"}`}
                      onClick={() => toggle(trade.id)}
                    >
                      <div className="flex items-center gap-2">
                        {symbolTypeMap[trade.symbol] && (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded border font-medium ${TYPE_STYLE[symbolTypeMap[trade.symbol]] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}
                          >
                            {symbolTypeMap[trade.symbol]}
                          </span>
                        )}
                        <a
                          href={
                            trade.symbolCode
                              ? `https://finance.naver.com/item/main.naver?code=${trade.symbolCode}`
                              : `https://finance.naver.com/search/search.naver?query=${encodeURIComponent(trade.symbol)}&endUrl=&encoding=UTF-8`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium hover:underline"
                        >
                          {trade.symbol}
                        </a>
                        {trade.symbolCode && (
                          <span className="text-gray-400 text-xs">
                            ({trade.symbolCode})
                          </span>
                        )}
                        {symbolSeq && (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded font-medium ${symbolColor?.badge}`}
                          >
                            {symbolSeq.seq}/{symbolSeq.total}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          매수 {trade.buyEntries.length}건
                          {trade.sellEntries.length > 0
                            ? ` · 매도 ${trade.sellEntries.length}건`
                            : ""}
                        </span>
                        {(() => {
                          const plan = planStatus(trade);
                          return plan && (
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${PLAN_TONE_STYLE[plan.tone]}`}>
                              📋 {plan.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {!trade.isCompleted ? (
                          <>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${holdingColor}`}
                            >
                              보유중 {trade.holdingDays}일
                            </span>
                            <span className="hidden sm:inline text-xs text-gray-500">
                              잔여 {trade.remainingQuantity}주
                            </span>
                            {trade.sellEntries.length > 0 && (
                              <>
                                <span className="hidden sm:inline text-gray-300 text-xs">
                                  |
                                </span>
                                <span className="hidden sm:inline text-xs text-gray-400">
                                  일부매도
                                </span>
                                <span
                                  className={`text-xs font-medium ${trade.profitAmount >= 0 ? "text-red-500" : "text-blue-500"}`}
                                >
                                  {(trade.profitAmount >= 0 ? "+" : "") +
                                    formatKRW(Math.round(trade.profitAmount))}
                                </span>
                                <span
                                  className={`hidden sm:inline text-xs ${trade.profitAmount >= 0 ? "text-red-400" : "text-blue-400"}`}
                                >
                                  {formatRate(trade.profitRate)}
                                </span>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${isPos ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}
                            >
                              완료 {formatRate(trade.profitRate)}
                            </span>
                            <span
                              className={`text-xs font-medium ${isPos ? "text-red-500" : "text-blue-500"}`}
                            >
                              {(isPos ? "+" : "") +
                                formatKRW(Math.round(trade.profitAmount))}
                            </span>
                            <span
                              className={`text-xs font-medium ${holdingColor.split(" ")[1]}`}
                            >
                              {trade.holdingDays}일
                            </span>
                          </>
                        )}
                        {!trade.isCompleted && (
                          <span className="text-xs text-gray-400">
                            {formatKRW(Math.round(trade.avgBuyPrice))}
                          </span>
                        )}
                        {!trade.isCompleted && trade.symbolCode && priceMap[trade.symbolCode] != null && (() => {
                          const currentPrice = priceMap[trade.symbolCode!];
                          const evalProfit = (currentPrice - trade.avgBuyPrice) * trade.remainingQuantity;
                          const evalRate = trade.avgBuyPrice > 0 ? (currentPrice / trade.avgBuyPrice - 1) * 100 : 0;
                          return (
                            <span className={`text-xs font-medium whitespace-nowrap ${evalProfit >= 0 ? "text-red-500" : "text-blue-500"}`}>
                              {(evalProfit >= 0 ? "+" : "") + formatKRW(Math.round(evalProfit))}
                              <span className="hidden sm:inline"> ({formatRate(evalRate)})</span>
                            </span>
                          );
                        })()}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(trade);
                          }}
                          className="text-xs text-gray-400 hover:text-gray-700 px-2 py-0.5 border rounded"
                        >
                          수정
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              confirm(
                                `"${trade.symbol}" 거래를 삭제하시겠습니까?`,
                              )
                            )
                              onDelete(trade);
                          }}
                          className="text-xs text-red-300 hover:text-red-500 px-2 py-0.5 border border-red-100 rounded"
                        >
                          삭제
                        </button>
                        <span className="text-gray-300 text-xs ml-1">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </div>
                    </div>

                    {/* 가격 차트 */}
                    {isExpanded && (
                      <TradeChart
                        buyEntries={trade.buyEntries}
                        sellEntries={trade.sellEntries}
                        avgBuyPrice={trade.avgBuyPrice}
                        isCompleted={trade.isCompleted}
                        targetPrice={trade.targetPrice}
                        stopLossPrice={trade.stopLossPrice}
                        currentPrice={trade.symbolCode ? priceMap[trade.symbolCode] : undefined}
                      />
                    )}

                    {/* 거래 내역 (접기/펼치기) */}
                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-t">
                          <thead>
                            <tr className="text-xs text-gray-400 border-b bg-gray-50">
                              <th className="px-4 py-1.5 text-center font-normal w-24">
                                구분
                              </th>
                              <th className="px-4 py-1.5 text-left font-normal">
                                날짜
                              </th>
                              <th className="px-4 py-1.5 text-right font-normal">
                                단가
                              </th>
                              <th className="px-4 py-1.5 text-right font-normal">
                                수량
                              </th>
                              <th className="px-4 py-1.5 text-right font-normal">
                                금액
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {entries.map((e, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-center">
                                  <span
                                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.type === "매수" ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-500"}`}
                                  >
                                    {e.type}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-gray-500 text-xs">
                                  {e.date.slice(0, 10)}
                                </td>
                                <td className="px-4 py-2 text-right">
                                  {formatKRW(e.price)}
                                </td>
                                <td className="px-4 py-2 text-right">
                                  {e.quantity}주
                                </td>
                                <td className="px-4 py-2 text-right">
                                  {formatKRW(e.price * e.quantity)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {isExpanded && trade.comment && (
                      <div className="px-4 py-1.5 text-xs text-gray-400 border-t bg-gray-50">
                        💬 {trade.comment}
                      </div>
                    )}
                    {isExpanded && (
                      <TradeImageZone
                        tradeId={trade.id}
                        images={imagesMap[trade.id] ?? trade.images}
                        onUpdate={(imgs) =>
                          setImagesMap((m) => ({ ...m, [trade.id]: imgs }))
                        }
                      />
                    )}
                    {isExpanded && !trade.isCompleted && (() => {
                      const pi = getPriceInput(trade)
                      const avg = trade.avgBuyPrice
                      const qty = trade.remainingQuantity
                      const targetNum = pi.target ? Number(pi.target) : null
                      const stopNum = pi.stop ? Number(pi.stop) : null
                      const targetProfit = targetNum && avg > 0 ? (targetNum - avg) * qty : null
                      const targetRate = targetNum && avg > 0 ? (targetNum / avg - 1) * 100 : null
                      const stopProfit = stopNum && avg > 0 ? (stopNum - avg) * qty : null
                      const stopRate = stopNum && avg > 0 ? (stopNum / avg - 1) * 100 : null
                      return (
                        <div className="px-4 py-2.5 border-t bg-gray-50 space-y-2">
                          {/* 목표가 */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-400 w-10 shrink-0">목표가</span>
                            <input
                              type="number"
                              value={pi.target}
                              onChange={e => updatePriceInput(trade.id, 'target', e.target.value)}
                              onBlur={() => savePrices(trade)}
                              onKeyDown={e => e.key === 'Enter' && savePrices(trade)}
                              placeholder="목표가"
                              className="border rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-red-300"
                            />
                            {targetProfit !== null && targetRate !== null && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-red-500">
                                  +{formatKRW(Math.round(targetProfit))}
                                </span>
                                <span className="text-xs text-red-400">+{targetRate.toFixed(1)}%</span>
                                <span className="text-xs text-gray-400">({qty}주 기준)</span>
                              </div>
                            )}
                          </div>
                          {/* 손절가 */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-400 w-10 shrink-0">손절가</span>
                            <input
                              type="number"
                              value={pi.stop}
                              onChange={e => updatePriceInput(trade.id, 'stop', e.target.value)}
                              onBlur={() => savePrices(trade)}
                              onKeyDown={e => e.key === 'Enter' && savePrices(trade)}
                              placeholder="손절가"
                              className="border rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-blue-300"
                            />
                            {stopProfit !== null && stopRate !== null && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-blue-500">
                                  {formatKRW(Math.round(stopProfit))}
                                </span>
                                <span className="text-xs text-blue-400">{stopRate.toFixed(1)}%</span>
                                <span className="text-xs text-gray-400">({qty}주 기준)</span>
                              </div>
                            )}
                          </div>
                          {savedSet.has(trade.id) && (
                            <span className="text-xs text-green-500">저장됨</span>
                          )}
                        </div>
                      )
                    })()}
                    {isExpanded && !trade.isCompleted && (
                      <div className="px-4 py-3 border-t bg-gray-50">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            예상 매도가
                          </span>
                          <input
                            type="number"
                            value={simPrices[trade.id] ?? ""}
                            onChange={(e) =>
                              setSimPrices((p) => ({
                                ...p,
                                [trade.id]: e.target.value,
                              }))
                            }
                            placeholder={String(Math.round(trade.avgBuyPrice))}
                            className="border rounded px-2 py-1 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            min="1"
                          />
                          {(() => {
                            const sim = calcSim(
                              trade,
                              simPrices[trade.id] ?? "",
                            );
                            if (!sim)
                              return (
                                <span className="text-xs text-gray-300">
                                  가격을 입력하면 예상 손익이 표시됩니다
                                </span>
                              );
                            const isP = sim.profit >= 0;
                            return (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-sm font-semibold ${isP ? "text-red-500" : "text-blue-500"}`}
                                >
                                  {(isP ? "+" : "") +
                                    formatKRW(Math.round(sim.profit))}
                                </span>
                                <span
                                  className={`text-xs ${isP ? "text-red-400" : "text-blue-400"}`}
                                >
                                  {formatRate(sim.rate)}
                                </span>
                                <span className="text-xs text-gray-400">
                                  ({trade.remainingQuantity}주 기준)
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
