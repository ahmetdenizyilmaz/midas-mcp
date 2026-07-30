/**
 * GraphQL documents used by this server.
 *
 * These mirror the operations the Midas Atlas web app itself sends. Field
 * selections are trimmed to what the tools actually surface.
 */

export const PORTFOLIO_OVERVIEW = /* GraphQL */ `
  query GetPortfolioOverview(
    $memberUid: String!
    $currencyCode: CurrencyCode!
    $timeRange: ProfitLossTimeRange!
  ) {
    overviewV2(memberUid: $memberUid, currencyCode: $currencyCode, timeRange: $timeRange) {
      portfolioValue
      profitLosses {
        timeRange
        value
        percentage
      }
      accounts {
        accountUid
        assetVertical
        currency
        buyingPower
        cash
        withdrawableCash
      }
    }
  }
`;

export const ALL_POSITIONS = /* GraphQL */ `
  query OverviewAllPositions(
    $memberUid: String!
    $includeUsStocks: Boolean!
    $includeTrStocks: Boolean!
    $includeTrFunds: Boolean!
    $includeUsOptions: Boolean! = false
  ) {
    usStocks: overviewPositionsV2(
      memberUid: $memberUid
      assetVertical: US
      investmentType: MARKET_INSTRUMENTS
    ) @include(if: $includeUsStocks) {
      ...PositionFields
    }
    trStocks: overviewPositionsV2(
      memberUid: $memberUid
      assetVertical: TR
      investmentType: MARKET_INSTRUMENTS
    ) @include(if: $includeTrStocks) {
      ...PositionFields
    }
    trFunds: overviewPositionsV2(
      memberUid: $memberUid
      assetVertical: TR
      investmentType: INVESTMENT_FUNDS
    ) @include(if: $includeTrFunds) {
      ...PositionFields
    }
    usOptions: overviewPositionsV2(
      memberUid: $memberUid
      assetVertical: US
      investmentType: OPTIONS
    ) @include(if: $includeUsOptions) {
      ...PositionFields
    }
  }

  fragment PositionFields on OverviewPositionResponseV2 {
    accountUid
    assetUid
    assetVertical
    symbol
    displayName
    quantity
    blockageQuantity
    averageCost
    currency
    country
    instrumentType
    multiplier
    tradePriceV3 {
      price
      currency
      tradingSessionStatus
    }
  }
`;

export const SEARCH = /* GraphQL */ `
  query Search(
    $query: String!
    $searchItemTypes: [SearchItemType!]!
    $page: Int! = 0
    $size: Int! = 30
  ) {
    Search(query: $query, searchItemTypes: $searchItemTypes, page: $page, size: $size) {
      results {
        uid
        type
        ... on InstrumentSearchResultItem {
          symbol
          title
          subtitle
          country
        }
        ... on InvestmentFundSearchResultItem {
          symbol
          title
          subtitle
          country
        }
      }
    }
  }
`;

export const ASSET_SNAPSHOT = /* GraphQL */ `
  query GetAssetSnapshot($uid: String!, $currency: CurrencyCode) {
    asset(uid: $uid) {
      uid
      name
      investmentType
      currency
      tradePrice(currency: $currency) {
        price
        currency
        tradingSessionStatus
      }
      previousClosePrice(currency: $currency)
      orderFlowEnabled
    }
  }
`;

/**
 * Returns tradability context for one instrument: buying power, sellable shares,
 * allowed order types, the daily price band, and the default order validity date.
 */
export const PREPARE_ORDER = /* GraphQL */ `
  query PrepareOrder($accountUid: String!, $input: OrderPreparationRequest!) {
    orderPreparationV2(accountUid: $accountUid, input: $input) {
      availableOrderTypes
      availableShares
      availableSharesDecoupled
      buyingPower
      buyingPowerDecoupled
      isFractionable
      country
      dayOrderRestricted
      priceRange(input: $input) {
        minPrice
        maxPrice
        fatFingerMinPrice
        fatFingerMaxPrice
      }
      validityPeriodDto {
        tradingRangeDto {
          validityPeriodCalendarItems {
            actionType
            isActive
            isSelected
            selectedOrderDate
            timeInForce
            title
          }
        }
      }
    }
  }
`;

export const PLACE_ORDER = /* GraphQL */ `
  mutation PlaceOrder($accountUid: String!, $request: PlaceOrderRequest!) {
    placeOrderV2(accountUid: $accountUid, input: $request) {
      order {
        uid
        accountUid
        side
        type
        status
        statusDescription
        quantity
        limitPrice
        totalPrice
      }
    }
  }
`;

export const CANCEL_ORDER = /* GraphQL */ `
  mutation CancelOrder($accountUid: String!, $orderId: String!, $stockUid: String) {
    cancelOrder(accountUid: $accountUid, orderId: $orderId, stockUid: $stockUid) {
      order {
        uid
        status
        statusDescription
      }
    }
  }
`;

export const PENDING_ORDERS = /* GraphQL */ `
  query PendingOrders($accountUid: String!, $stockUid: String!) {
    pendingOrders(accountUid: $accountUid, stockUid: $stockUid) {
      orders {
        uid
        type
        side
        status
        quantity
        limitPrice
        stopPrice
        showCancel
      }
    }
  }
`;
