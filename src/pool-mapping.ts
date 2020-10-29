import { LOG_DENORM_UPDATED, LOG_DESIRED_DENORM_SET, LOG_SWAP, LOG_JOIN, LOG_EXIT, Transfer, IPool, LOG_TOKEN_REMOVED, LOG_TOKEN_ADDED, LOG_TOKEN_READY } from "../generated/templates/IPool/IPool";
import { PoolUnderlyingToken, IndexPoolBalance, DailyPoolSnapshot, IndexPool, Swap } from "../generated/schema";
import { Address, ethereum, BigInt, Bytes, BigDecimal } from "@graphprotocol/graph-ts";
import { LOG_MAX_TOKENS_UPDATED, LOG_MINIMUM_BALANCE_UPDATED, LOG_SWAP_FEE_UPDATED } from "../generated/templates/IPool/IPool";
import { hexToDecimal, joinHyphen } from "./helpers";

function loadUnderlyingToken(poolAddress: Address, tokenAddress: Address): PoolUnderlyingToken {
  let tokenID = joinHyphen([poolAddress.toHexString(), tokenAddress.toHexString()]);
  return PoolUnderlyingToken.load(tokenID) as PoolUnderlyingToken;
}

function indexPoolBalanceID(poolAddress: Address, ownerAddress: Address): string {
  return joinHyphen(['bal', poolAddress.toHexString(), ownerAddress.toHexString()]);
}

function loadIndexPoolBalance(poolAddress: Address, ownerAddress: Address): IndexPoolBalance {
  let balanceID = indexPoolBalanceID(poolAddress, ownerAddress);
  let bal = IndexPoolBalance.load(balanceID);
  if (bal == null) {
    bal = new IndexPoolBalance(balanceID);
    bal.pool = poolAddress.toHexString();
    bal.balance = BigInt.fromI32(0);
    bal.save();
  }
  // make the compiler feel better about its pedantry
  return bal as IndexPoolBalance;
}

function updateDailySnapshot(event: ethereum.Event): void {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let poolDayID = event.address
    .toHexString()
    .concat('-')
    .concat(BigInt.fromI32(dayID).toString());
  // If we already have a daily snapshot, don't do anything.
  if (DailyPoolSnapshot.load(poolDayID) != null) return;

  let snapshot = new DailyPoolSnapshot(poolDayID);
  snapshot.pool = event.address.toHexString();
  snapshot.timestamp = timestamp;
  snapshot.tokens = [];
  snapshot.balances = [];
  snapshot.denorms = [];
  snapshot.desiredDenorms = [];

  let bpool = IPool.bind(event.address);
  let tokens = bpool.getCurrentTokens();
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    let record = bpool.getTokenRecord(token);
    snapshot.tokens.push(token.toHexString());
    snapshot.balances.push(record.balance);
    snapshot.denorms.push(record.denorm);
    snapshot.desiredDenorms.push(record.desiredDenorm);
  }
  snapshot.save();
}

export function handleSwap(event: LOG_SWAP): void {
  let tokenIn = loadUnderlyingToken(event.address, event.params.tokenIn);
  let tokenOut = loadUnderlyingToken(event.address, event.params.tokenOut);
  tokenIn.balance = tokenIn.balance.plus(event.params.tokenAmountIn);
  tokenOut.balance = tokenOut.balance.minus(event.params.tokenAmountOut);
  tokenIn.save();
  tokenOut.save();
  updateDailySnapshot(event);
  let swapID = joinHyphen([
    event.transaction.hash.toHexString(),
    event.logIndex.toHexString()
  ]);
  let swap = new Swap(swapID);
  swap.caller = event.params.caller;
  swap.tokenIn = event.params.tokenIn;
  swap.tokenOut = event.params.tokenOut;
  swap.tokenAmountIn = event.params.tokenAmountIn;
  swap.tokenAmountOut = event.params.tokenAmountOut;
  swap.pool = event.address.toHexString();
  swap.timestamp = event.block.timestamp as u8;
  swap.save();
}

export function handleJoin(event: LOG_JOIN): void {
  let tokenIn = loadUnderlyingToken(event.address, event.params.tokenIn);
  tokenIn.balance = tokenIn.balance.plus(event.params.tokenAmountIn);
  tokenIn.save();
}

export function handleExit(event: LOG_EXIT): void {
  let tokenOut = loadUnderlyingToken(event.address, event.params.tokenOut);
  tokenOut.balance = tokenOut.balance.minus(event.params.tokenAmountOut);
  tokenOut.save();
  updateDailySnapshot(event);
}

export function handleDenormUpdated(event: LOG_DENORM_UPDATED): void {
  let token = loadUnderlyingToken(event.address, event.params.token);
  let pool = IndexPool.load(event.address.toHexString());
  let oldDenorm = token.denorm;
  let newDenorm = event.params.newDenorm;
  if (newDenorm.gt(oldDenorm)) {
    let diff = newDenorm.minus(oldDenorm);
    pool.totalWeight = pool.totalWeight.plus(diff);
  } else if (oldDenorm.gt(newDenorm)) {
    let diff = oldDenorm.minus(newDenorm);
    pool.totalWeight = pool.totalWeight.minus(diff);
  }
  pool.save();
  token.denorm = event.params.newDenorm;
  token.save();
  updateDailySnapshot(event);
}

export function handleDesiredDenormSet(event: LOG_DESIRED_DENORM_SET): void {
  let token = loadUnderlyingToken(event.address, event.params.token);
  token.desiredDenorm = event.params.desiredDenorm;
  token.save();
  updateDailySnapshot(event);
}

export function handleTransfer(event: Transfer): void {
  let pool = IndexPool.load(event.address.toHexString());
  let isMint = event.params.src.toHexString() == `0x${'00'.repeat(20)}`;
  let isBurn = event.params.dst.toHexString() == `0x${'00'.repeat(20)}`;
  if (isMint) {
    pool.totalSupply = pool.totalSupply.plus(event.params.amt);
  } else {
    let sender = loadIndexPoolBalance(event.address, event.params.src);
    sender.balance = sender.balance.minus(event.params.amt);
    sender.save();
  }
  if (isBurn) {
    pool.totalSupply = pool.totalSupply.minus(event.params.amt);
  } else {
    let receiver = loadIndexPoolBalance(event.address, event.params.dst);
    receiver.balance = receiver.balance.plus(event.params.amt);
    receiver.save();
  }
  if (isBurn || isMint) {
    pool.save();
  }
  updateDailySnapshot(event);
}

export function handleTokenRemoved(event: LOG_TOKEN_REMOVED): void {
  let record = loadUnderlyingToken(event.address, event.params.token);
  record.pool = 'null';
  record.save();
}

export function handleTokenAdded(event: LOG_TOKEN_ADDED): void {
  let tokenID = joinHyphen([event.address.toHexString(), event.params.token.toHexString()]);
  let token = new PoolUnderlyingToken(tokenID as string);
  token.token = event.params.token.toHexString();
  token.ready = false;
  token.minimumBalance = event.params.minimumBalance;
  token.denorm = new BigInt(0);
  token.desiredDenorm = event.params.desiredDenorm;
  token.balance = new BigInt(0);
  token.pool = event.address.toHexString();
  token.save();
}

export function handleTokenReady(event: LOG_TOKEN_READY): void {
  let token = loadUnderlyingToken(event.address, event.params.token);
  token.ready = true;
  token.minimumBalance = null;
  token.save();
}

export function handleUpdateMinimumBalance(event: LOG_MINIMUM_BALANCE_UPDATED): void {
  let token = loadUnderlyingToken(event.address, event.params.token);
  token.minimumBalance = event.params.minimumBalance;
  token.save();
}

export function handleMaxTokensUpdated(event: LOG_MAX_TOKENS_UPDATED): void {
  let pool = IndexPool.load(event.address.toHexString());
  pool.maxTotalSupply = event.params.maxPoolTokens;
  pool.save();
}

export function handleSwapFeeUpdated(event: LOG_SWAP_FEE_UPDATED): void {
  let pool = IndexPool.load(event.address.toHexString());
  let swapFee = hexToDecimal(event.params.swapFee.toHexString(), 18);
  pool.swapFee = swapFee;
  pool.save();
}
