import { gql, MidasApiError } from "./api.js";
import { config } from "./config.js";
import { session } from "./session.js";
import * as Q from "./queries.js";

export type Side = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT";

export interface Account {
  accountUid: string;
  assetVertical: "TR" | "US";
  currency: string;
  buyingPower: number;
  cash: number;
  withdrawableCash: number;
}

export interface Position {
  symbol: string;
  name: string;
  assetUid: string;
  accountUid: string;
  market: "TR" | "US";
  quantity: number;
  averageCost: number;
  price: number | null;
  currency: string;
  marketValue: number | null;
  profitLoss: number | null;
  profitLossPercent: number | null;
  sessionStatus: string | null;
}

/** Portfolio value, day P/L, and per-market cash balances. */
export async function getPortfolio() {
  const memberUid = await session.getMemberUid();
  const data = await gql("GetPortfolioOverview", Q.PORTFOLIO_OVERVIEW, {
    memberUid,
    currencyCode: "TRY",
    timeRange: "DAY",
  });
  const o = data.overviewV2;
  return {
    portfolioValueTry: o.portfolioValue,
    dayProfitLoss: o.profitLosses?.find((p: any) => p.timeRange === "DAY") ?? null,
    accounts: (o.accounts ?? []) as Account[],
  };
}

async function getAccounts(): Promise<Account[]> {
  return (await getPortfolio()).accounts;
}

async function accountFor(market: "TR" | "US"): Promise<Account> {
  const account = (await getAccounts()).find((a) => a.assetVertical === market);
  if (!account) throw new MidasApiError(`No ${market} account found on this Midas profile`);
  return account;
}

/** All open positions across BIST stocks, US stocks, TR funds and US options. */
export async function getPositions(): Promise<Position[]> {
  const memberUid = await session.getMemberUid();
  const data = await gql(
    "OverviewAllPositions",
    Q.ALL_POSITIONS,
    {
      memberUid,
      includeUsStocks: true,
      includeTrStocks: true,
      includeTrFunds: true,
      includeUsOptions: true,
    },
    "overviewPositionsV2"
  );

  const groups = [data.trStocks, data.usStocks, data.trFunds, data.usOptions];
  const positions: Position[] = [];
  for (const group of groups) {
    for (const p of group ?? []) {
      const price: number | null = p.tradePriceV3?.price ?? null;
      const multiplier = p.multiplier ?? 1;
      const marketValue = price === null ? null : price * p.quantity * multiplier;
      const costBasis = p.averageCost * p.quantity * multiplier;
      positions.push({
        symbol: p.symbol,
        name: p.displayName ?? p.symbol,
        assetUid: p.assetUid,
        accountUid: p.accountUid,
        market: p.assetVertical,
        quantity: p.quantity,
        averageCost: p.averageCost,
        price,
        currency: p.currency,
        marketValue,
        profitLoss: marketValue === null ? null : marketValue - costBasis,
        profitLossPercent:
          marketValue === null || costBasis === 0 ? null : ((marketValue - costBasis) / costBasis) * 100,
        sessionStatus: p.tradePriceV3?.tradingSessionStatus ?? null,
      });
    }
  }
  return positions;
}

export interface ResolvedAsset {
  uid: string;
  symbol: string;
  title: string;
  subtitle: string;
  country: "TR" | "US";
}

/**
 * Resolve a ticker to a Midas instrument uid. Prefers an exact symbol match;
 * falls back to the first search hit so partial names still work.
 */
export async function resolveSymbol(symbol: string): Promise<ResolvedAsset> {
  const data = await gql("Search", Q.SEARCH, {
    query: symbol,
    searchItemTypes: ["MARKET_INSTRUMENTS", "INVESTMENT_FUNDS"],
    page: 0,
    size: 30,
  });
  const results = (data.Search?.results ?? []).filter((r: any) => r.symbol);
  if (!results.length) throw new MidasApiError(`No instrument found for "${symbol}"`);

  const wanted = symbol.trim().toUpperCase();
  const hit = results.find((r: any) => r.symbol.toUpperCase() === wanted) ?? results[0];
  return {
    uid: hit.uid,
    symbol: hit.symbol,
    title: hit.title,
    subtitle: hit.subtitle,
    country: hit.country,
  };
}

/** Last trade price for a symbol, optionally converted to another currency. */
export async function getAssetPrice(symbol: string, currency?: "TRY" | "USD") {
  const asset = await resolveSymbol(symbol);
  const data = await gql("GetAssetSnapshot", Q.ASSET_SNAPSHOT, {
    uid: asset.uid,
    currency: currency ?? null,
  });
  const a = data.asset;
  const price = a.tradePrice?.price ?? null;
  const previousClose = a.previousClosePrice ?? null;
  return {
    symbol: asset.symbol,
    name: a.name,
    uid: a.uid,
    price,
    currency: a.tradePrice?.currency ?? a.currency,
    previousClose,
    changePercent:
      price === null || !previousClose ? null : ((price - previousClose) / previousClose) * 100,
    sessionStatus: a.tradePrice?.tradingSessionStatus ?? null,
    tradable: a.orderFlowEnabled ?? false,
  };
}

/** Descriptive info plus current pricing for a symbol. */
export async function getAssetInfo(symbol: string) {
  const asset = await resolveSymbol(symbol);
  const price = await getAssetPrice(asset.symbol);
  return {
    ...price,
    market: asset.country === "TR" ? "BIST" : "US",
    description: asset.subtitle,
  };
}

interface Preparation {
  availableOrderTypes: string[];
  availableShares: number | null;
  buyingPower: number | null;
  isFractionable: boolean;
  country: "TR" | "US";
  priceRange: {
    minPrice: number | null;
    maxPrice: number | null;
    fatFingerMinPrice: number | null;
    fatFingerMaxPrice: number | null;
  } | null;
  defaultEndingDate: string | null;
}

async function prepareOrder(
  accountUid: string,
  stockUid: string,
  side: Side,
  type: OrderType
): Promise<Preparation> {
  const data = await gql("PrepareOrder", Q.PREPARE_ORDER, {
    accountUid,
    input: { side, stockUid, type },
  });
  const p = data.orderPreparationV2;
  const items = p?.validityPeriodDto?.tradingRangeDto?.validityPeriodCalendarItems ?? [];
  const selected = items.find((i: any) => i.isSelected && i.selectedOrderDate) ?? items.find((i: any) => i.selectedOrderDate);
  // The web app reads the "Decoupled" variants; the plain fields read 0 outside a session.
  const availableShares = p?.availableSharesDecoupled ?? p?.availableShares ?? null;
  return {
    availableOrderTypes: p?.availableOrderTypes ?? [],
    availableShares,
    buyingPower: p?.buyingPowerDecoupled ?? p?.buyingPower ?? null,
    isFractionable: p?.isFractionable ?? false,
    country: p?.country ?? "TR",
    priceRange: p?.priceRange ?? null,
    defaultEndingDate: selected?.selectedOrderDate ?? null,
  };
}

export interface OrderRequest {
  symbol: string;
  side: Side;
  quantity: number;
  orderType?: OrderType;
  limitPrice?: number;
}

/**
 * Place a buy or sell order.
 *
 * Refuses, before contacting the order endpoint, any order whose estimated value in
 * TRY exceeds MAX_ORDER_VALUE_TRY. US instruments are valued by asking Midas for the
 * TRY-converted price, so one cap covers both markets.
 */
export async function placeOrder(req: OrderRequest) {
  const { symbol, side, quantity } = req;
  const orderType: OrderType = req.orderType ?? (req.limitPrice != null ? "LIMIT" : "MARKET");

  if (!(quantity > 0)) throw new MidasApiError("quantity must be greater than 0");
  if (orderType === "LIMIT" && req.limitPrice == null) {
    throw new MidasApiError("limit_price is required for LIMIT orders");
  }

  const asset = await resolveSymbol(symbol);
  const market = asset.country === "TR" ? "TR" : "US";
  const account = await accountFor(market);

  // Value the order in TRY so the safety cap is currency-independent.
  const tryQuote = await gql("GetAssetSnapshot", Q.ASSET_SNAPSHOT, {
    uid: asset.uid,
    currency: "TRY",
  });
  const tryPrice: number | null = tryQuote.asset?.tradePrice?.price ?? null;
  if (tryPrice === null) {
    throw new MidasApiError(`No TRY price available for ${asset.symbol}; refusing to trade blind`);
  }
  const estimatedTry = tryPrice * quantity;
  if (estimatedTry > config.maxOrderValueTry) {
    throw new MidasApiError(
      `Refusing order: estimated value ₺${estimatedTry.toFixed(2)} exceeds the ₺${config.maxOrderValueTry} cap ` +
        `(MAX_ORDER_VALUE_TRY in .env). Reduce the quantity or raise the cap deliberately.`
    );
  }

  const prep = await prepareOrder(account.accountUid, asset.uid, side, orderType);

  if (prep.availableOrderTypes.length && !prep.availableOrderTypes.includes(orderType)) {
    throw new MidasApiError(
      `${orderType} orders are not accepted for ${asset.symbol} right now. Available: ${prep.availableOrderTypes.join(", ")}`
    );
  }
  if (side === "SELL" && prep.availableShares != null && quantity > prep.availableShares) {
    throw new MidasApiError(
      `Cannot sell ${quantity} ${asset.symbol}: only ${prep.availableShares} available to sell`
    );
  }
  if (!prep.isFractionable && !Number.isInteger(quantity)) {
    throw new MidasApiError(`${asset.symbol} does not support fractional quantities`);
  }
  if (orderType === "LIMIT" && prep.priceRange) {
    const { minPrice, maxPrice } = prep.priceRange;
    const p = req.limitPrice!;
    if (minPrice != null && p < minPrice) {
      throw new MidasApiError(`limit_price ${p} is below the daily price band minimum ${minPrice}`);
    }
    if (maxPrice != null && p > maxPrice) {
      throw new MidasApiError(`limit_price ${p} is above the daily price band maximum ${maxPrice}`);
    }
  }

  const request: Record<string, unknown> = {
    type: orderType,
    side,
    stockUid: asset.uid,
    quantity,
  };
  if (orderType === "LIMIT") {
    request.limitPrice = req.limitPrice;
    if (prep.defaultEndingDate) request.endingDate = prep.defaultEndingDate;
  }

  const data = await gql("PlaceOrder", Q.PLACE_ORDER, {
    accountUid: account.accountUid,
    request,
  });
  const order = data.placeOrderV2?.order;
  if (!order?.uid) throw new MidasApiError("Order was not accepted (no order id returned)");

  return {
    orderId: order.uid,
    symbol: asset.symbol,
    side: order.side,
    orderType: order.type,
    status: order.status,
    statusDescription: order.statusDescription,
    quantity: order.quantity,
    limitPrice: order.limitPrice,
    estimatedValueTry: Number(estimatedTry.toFixed(2)),
    accountUid: account.accountUid,
    stockUid: asset.uid,
  };
}

export async function getPendingOrders(symbol: string) {
  const asset = await resolveSymbol(symbol);
  const account = await accountFor(asset.country === "TR" ? "TR" : "US");
  const data = await gql("PendingOrders", Q.PENDING_ORDERS, {
    accountUid: account.accountUid,
    stockUid: asset.uid,
  });
  return {
    symbol: asset.symbol,
    accountUid: account.accountUid,
    stockUid: asset.uid,
    orders: data.pendingOrders?.orders ?? [],
  };
}

export async function cancelOrder(orderId: string, symbol: string) {
  const asset = await resolveSymbol(symbol);
  const account = await accountFor(asset.country === "TR" ? "TR" : "US");
  const data = await gql("CancelOrder", Q.CANCEL_ORDER, {
    accountUid: account.accountUid,
    orderId,
    stockUid: asset.uid,
  });
  const order = data.cancelOrder?.order;
  return {
    orderId: order?.uid ?? orderId,
    status: order?.status ?? "UNKNOWN",
    statusDescription: order?.statusDescription ?? null,
  };
}
