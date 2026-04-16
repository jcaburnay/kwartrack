// Re-export the schema as the default export — required by spacetime CLI bundler
// Also re-export fire_recurring_transaction and check_td_maturity so SpacetimeDB can resolve the scheduled reducers

// Lifecycle hooks — must be re-exported so SpacetimeDB registers the clientConnected reducer
export { on_connect } from "./lifecycle";
export * from "./reducers/accounts";
export * from "./reducers/budget";
export * from "./reducers/debts";
export * from "./reducers/identity";
export * from "./reducers/recurring";
export * from "./reducers/splits";
export * from "./reducers/subAccounts";
export * from "./reducers/tags";
// Reducers — grouped by domain
export * from "./reducers/transactions";
export { check_td_maturity, default, fire_recurring_transaction } from "./schema";
// Views
export * from "./views";
