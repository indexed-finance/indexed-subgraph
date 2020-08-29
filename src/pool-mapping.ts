import { LOG_DENORM_UPDATED, LOG_DESIRED_DENORM_SET, LOG_SWAP, LOG_JOIN, LOG_EXIT, Transfer, BPool } from "../generated/templates/BPool/BPool";
import { PoolUnderlyingToken, IndexPoolBalance, DailyPoolSnapshot } from "../generated/schema";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";

const toStr = (addr: string | Address) => typeof addr == 'string' ? addr : addr.toHex();

function underlyingTokenID(
  poolAddress: string | Address,
  tokenAddress: string | Address
): string {
  let _poolID = toStr(poolAddress);
  let _tokenID = toStr(tokenAddress);
  return `${_poolID}-${_tokenID}`;
}

function loadUnderlyingToken(
  poolAddress: string | Address,
  tokenAddress: string | Address
): PoolUnderlyingToken {
  const tokenID = underlyingTokenID(poolAddress, tokenAddress);
  return PoolUnderlyingToken.load(tokenID);
}

function indexPoolBalanceID(
  poolAddress: string | Address,
  ownerAddress: string | Address
): string {
  let _poolID = toStr(poolAddress);
  let _ownerID = toStr(ownerAddress);
  return `bal-${_poolID}-${_ownerID}`;
}

function loadIndexPoolBalance(
  poolAddress: string | Address,
  ownerAddress: string | Address
): IndexPoolBalance {
  const balanceID = indexPoolBalanceID(poolAddress, ownerAddress);
  let bal = IndexPoolBalance.load(balanceID);
  if (bal == null) {
    bal = new IndexPoolBalance(balanceID);
    bal.pool = toStr(poolAddress);
    bal.save();
  }
  return bal;
}

function updateDailySnapshot(event: ethereum.Event): void {
  // poolAddress: string | Address, timestamp: BigInt
  const timestamp = event.block.timestamp.toI32();
  const dayID = timestamp / 86400;
  const poolDayID = `${toStr(event.address)}-${dayID}`;
  if (DailyPoolSnapshot.load(poolDayID)) return;
  const snapshot = new DailyPoolSnapshot(poolDayID);
  const bpool = BPool.bind(event.address);
  const tokens = bpool.getCurrentTokens();
  snapshot.tokens = tokens.map(t => t.toHex());
  const records = tokens.map(t => bpool.getTokenRecord(t));
  snapshot.balances = records.map(r => r.balance);
  snapshot.pool = event.address.toHex();
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
  const isMint = event.params.src.toHex() == `0x${'00'.repeat(20)}`;
  if (!isMint) {
    let sender = loadIndexPoolBalance(event.address, event.params.src);
    sender.balance = sender.balance.minus(event.params.amt);
    sender.save();
  }
  const isBurn = event.params.dst.toHex() == `0x${'00'.repeat(20)}`;
  if (!isBurn) {
    let receiver = loadIndexPoolBalance(event.address, event.params.dst);
    receiver.balance = receiver.balance.plus(event.params.amt);
    receiver.save();
  }
  updateDailySnapshot(event);
}