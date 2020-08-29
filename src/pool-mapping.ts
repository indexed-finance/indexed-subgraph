import { LOG_DENORM_UPDATED, LOG_DESIRED_DENORM_SET, LOG_SWAP, LOG_JOIN, LOG_EXIT, Transfer, BPool } from "../generated/templates/BPool/BPool";
import { PoolUnderlyingToken, IndexPoolBalance, DailyPoolSnapshot } from "../generated/schema";
import { Address, ethereum, BigInt } from "@graphprotocol/graph-ts";

function joinHyphen(a: Address, b: Address): string {
  return a.toHexString().concat('-').concat(b.toHexString());
}

function loadUnderlyingToken(
  poolAddress: Address,
  tokenAddress: Address
): PoolUnderlyingToken {
  let tokenID = joinHyphen(poolAddress, tokenAddress);
  return PoolUnderlyingToken.load(tokenID) as PoolUnderlyingToken;
}

function indexPoolBalanceID(
  poolAddress: Address,
  ownerAddress: Address
): string {
  return `bal-`.concat(joinHyphen(poolAddress, ownerAddress));
}

function loadIndexPoolBalance(
  poolAddress: Address,
  ownerAddress: Address
): IndexPoolBalance {
  let balanceID = indexPoolBalanceID(poolAddress, ownerAddress);
  let bal = IndexPoolBalance.load(balanceID);
  if (bal == null) {
    bal = new IndexPoolBalance(balanceID);
    bal.pool = poolAddress.toHexString();
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
  snapshot.tokens = [];
  snapshot.balances = [];

  let bpool = BPool.bind(event.address);
  let tokens = bpool.getCurrentTokens();
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    snapshot.tokens.push(token.toHexString());
    let record = bpool.getTokenRecord(token);
    snapshot.balances.push(record.balance);
  }
  snapshot.pool = event.address.toHexString();
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
  let isMint = event.params.src.toHexString() == `0x${'00'.repeat(20)}`;
  if (!isMint) {
    let sender = loadIndexPoolBalance(event.address, event.params.src);
    sender.balance = sender.balance.minus(event.params.amt);
    sender.save();
  }
  let isBurn = event.params.dst.toHexString() == `0x${'00'.repeat(20)}`;
  if (!isBurn) {
    let receiver = loadIndexPoolBalance(event.address, event.params.dst);
    receiver.balance = receiver.balance.plus(event.params.amt);
    receiver.save();
  }
  updateDailySnapshot(event);
}