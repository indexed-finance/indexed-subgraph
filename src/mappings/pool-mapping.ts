import { LOG_DENORM_UPDATED, LOG_DESIRED_DENORM_SET, LOG_SWAP, LOG_JOIN, LOG_EXIT, Transfer, IPool, LOG_TOKEN_REMOVED, LOG_TOKEN_ADDED, LOG_TOKEN_READY } from "../../generated/templates/IPool/IPool";
import { PoolUnderlyingToken, IndexPoolBalance, DailyPoolSnapshot, IndexPool, Swap, Token } from "../../generated/schema";
import { Address, ethereum, BigInt, log, Bytes } from "@graphprotocol/graph-ts";
import { LOG_MAX_TOKENS_UPDATED, LOG_MINIMUM_BALANCE_UPDATED, LOG_SWAP_FEE_UPDATED } from "../../generated/templates/IPool/IPool";
import { convertEthToDecimal, hexToDecimal, joinHyphen, ZERO_BI } from "../helpers/general";
import { getTokenPriceUSD } from "../helpers/pricing";
import { convertTokenToDecimal, ZERO_BD } from "../helpers/general";
import { ADDRESS_ZERO } from '../helpers/uniswap';

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

function updateDailySnapshot(pool: IndexPool, event: ethereum.Event): void {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 3600;
  let poolDayID = event.address
    .toHexString()
    .concat('-')
    .concat(BigInt.fromI32(dayID).toString());
  let snapshot = DailyPoolSnapshot.load(poolDayID);
  if (snapshot == null) {
    snapshot = new DailyPoolSnapshot(poolDayID);
  }

  snapshot.pool = event.address.toHexString();
  snapshot.date = dayID * 3600;

  let tokenAddresses = pool.tokensList;
  let balances = new Array<BigInt>()
  let denorms = new Array<BigInt>()
  let desiredDenorms = new Array<BigInt>()
  let tokens = new Array<Bytes>()
  let totalValueLockedUSD = ZERO_BD

  for (let i = 0 as i32; i < tokenAddresses.length; i++) {
    let tokenAddress = tokenAddresses[i]
    let poolToken = loadUnderlyingToken(Address.fromString(pool.id), tokenAddress as Address) as PoolUnderlyingToken
    balances.push(poolToken.balance)
    denorms.push(poolToken.denorm)
    desiredDenorms.push(poolToken.desiredDenorm)
    tokens.push(tokenAddress)
    let token = Token.load(tokenAddress.toHexString())
    let balance = convertTokenToDecimal(poolToken.balance, token.decimals)
    let value = balance.times(token.priceUSD)
    totalValueLockedUSD = totalValueLockedUSD.plus(value)
  }
  snapshot.balances = balances;
  snapshot.denorms = denorms;
  snapshot.desiredDenorms = desiredDenorms;
  snapshot.tokens = tokens;

  pool.totalValueLockedUSD = totalValueLockedUSD
  pool.save()
  let totalSupply = convertEthToDecimal(pool.totalSupply);
  let value = totalValueLockedUSD.div(totalSupply);
  snapshot.value = value;
  snapshot.totalSupply = totalSupply
  snapshot.feesTotalUSD = pool.feesTotalUSD
  snapshot.totalValueLockedUSD = pool.totalValueLockedUSD
  snapshot.totalSwapVolumeUSD = pool.totalSwapVolumeUSD
  snapshot.totalVolumeUSD = pool.totalVolumeUSD
  snapshot.save();
}

function updateTokenPrices(pool: IndexPool): void {
  let tokenAddresses = pool.tokensList

  for (let i = 0; i < tokenAddresses.length; i++) {
    let tokenAddress = tokenAddresses[i]
    let token = Token.load(tokenAddress.toHexString()) as Token
    token.priceUSD = getTokenPriceUSD(token)
    token.save()
  }
}

export function handleSwap(event: LOG_SWAP): void {
  let poolTokenIn = loadUnderlyingToken(event.address, event.params.tokenIn);
  let poolTokenOut = loadUnderlyingToken(event.address, event.params.tokenOut);
  poolTokenIn.balance = poolTokenIn.balance.plus(event.params.tokenAmountIn);
  poolTokenOut.balance = poolTokenOut.balance.minus(event.params.tokenAmountOut);
  poolTokenIn.save();
  poolTokenOut.save();

  let pool = IndexPool.load(event.address.toHexString())
  if (pool == null) {
    log.error('Pool was null!', [])
  }
  updateTokenPrices(pool as IndexPool)

  let tokenOut = Token.load(poolTokenOut.token)
  let tokenAmountOutDecimal = convertTokenToDecimal(event.params.tokenAmountOut, tokenOut.decimals)
  let swapValue = tokenAmountOutDecimal.times(tokenOut.priceUSD)
  let swapFeeValue = swapValue.times(pool.swapFee)

  updateDailySnapshot(pool as IndexPool, event);
  pool.feesTotalUSD = pool.feesTotalUSD.plus(swapFeeValue)
  pool.totalSwapVolumeUSD = pool.totalSwapVolumeUSD.plus(swapValue)
  pool.totalVolumeUSD = pool.totalVolumeUSD.plus(swapValue)
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
  swap.timestamp = event.block.timestamp.toI32();
  pool.save();
  swap.save();
}

export function handleJoin(event: LOG_JOIN): void {
  let tokenIn = loadUnderlyingToken(event.address, event.params.tokenIn);
  let tokenInStore = Token.load(event.params.tokenIn.toHexString());
  let tokenInDecimal = convertTokenToDecimal(event.params.tokenAmountIn, tokenInStore.decimals);
  let pool = IndexPool.load(event.address.toHexString()) as IndexPool;
  let usdValue = tokenInDecimal.times(tokenInStore.priceUSD);

  tokenIn.balance = tokenIn.balance.plus(event.params.tokenAmountIn);
  tokenIn.save();
  pool.totalVolumeUSD = pool.totalVolumeUSD.plus(usdValue);
  pool.save();
  updateTokenPrices(pool as IndexPool);
  updateDailySnapshot(pool, event);
}

export function handleExit(event: LOG_EXIT): void {
  let pool = IndexPool.load(event.address.toHexString()) as IndexPool
  updateTokenPrices(pool as IndexPool);
  let tokenOut = loadUnderlyingToken(event.address, event.params.tokenOut);
  let tokenOutStore = Token.load(event.params.tokenOut.toHexString());
  let tokenOutDecimal = convertTokenToDecimal(event.params.tokenAmountOut, tokenOutStore.decimals);
  let usdValue = tokenOutDecimal.times(tokenOutStore.priceUSD);

  tokenOut.balance = tokenOut.balance.minus(event.params.tokenAmountOut);
  tokenOut.save();
  pool.totalVolumeUSD = pool.totalVolumeUSD.plus(usdValue);
  pool.save();
  updateDailySnapshot(pool, event);
}

export function handleDenormUpdated(event: LOG_DENORM_UPDATED): void {
  let token = loadUnderlyingToken(event.address, event.params.token);
  let pool = IndexPool.load(event.address.toHexString()) as IndexPool
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
  updateTokenPrices(pool as IndexPool);
  updateDailySnapshot(pool as IndexPool, event);
}

export function handleDesiredDenormSet(event: LOG_DESIRED_DENORM_SET): void {
  let token = loadUnderlyingToken(event.address, event.params.token);
  token.desiredDenorm = event.params.desiredDenorm;
  token.save();
  let pool = IndexPool.load(event.address.toHexString()) as IndexPool;
  updateTokenPrices(pool as IndexPool);
  updateDailySnapshot(pool, event);
}

export function handleTransfer(event: Transfer): void {
  let pool = IndexPool.load(event.address.toHexString()) as IndexPool
  let isMint = event.params.src.toHexString() == ADDRESS_ZERO;
  let isBurn = event.params.dst.toHexString() == ADDRESS_ZERO;
  if (isMint) {
    pool.totalSupply = pool.totalSupply.plus(event.params.amt);
    pool.save();
  } else {
    let sender = loadIndexPoolBalance(event.address, event.params.src);
    sender.balance = sender.balance.minus(event.params.amt);
    sender.save();
  }
  if (isBurn) {
    pool.totalSupply = pool.totalSupply.minus(event.params.amt);
    pool.save();
  } else {
    let receiver = loadIndexPoolBalance(event.address, event.params.dst);
    receiver.balance = receiver.balance.plus(event.params.amt);
    receiver.save();
  }
  pool.save();
  updateTokenPrices(pool as IndexPool);
  updateDailySnapshot(pool, event);
}

export function handleTokenRemoved(event: LOG_TOKEN_REMOVED): void {
  let record = loadUnderlyingToken(event.address, event.params.token);
  record.pool = 'null';
  record.save();
  let tokensList = new Array<Bytes>();
  let pool = IndexPool.load(event.address.toHexString());
  let currentTokens = pool.tokensList;
  for (let i = 0 as i32; i < currentTokens.length; i++) {
    let token = currentTokens[i];
    if (token.toString() != event.params.token.toString()) {
      tokensList.push(token);
    }
  }
  pool.tokensList = tokensList;
  pool.save();
}

export function handleTokenAdded(event: LOG_TOKEN_ADDED): void {
  let tokenID = joinHyphen([event.address.toHexString(), event.params.token.toHexString()]);
  let token = new PoolUnderlyingToken(tokenID as string);
  token.token = event.params.token.toHexString();
  token.ready = false;
  token.minimumBalance = event.params.minimumBalance;
  token.denorm = ZERO_BI
  token.desiredDenorm = event.params.desiredDenorm;
  token.balance = ZERO_BI
  token.pool = event.address.toHexString();
  token.save();
  let pool = IndexPool.load(event.address.toHexString());
  let currentTokens = pool.tokensList;
  currentTokens.push(event.params.token);
  pool.tokensList = currentTokens;
  pool.save();
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

export function handleSwapFeeUpdated(event: LOG_SWAP_FEE_UPDATED): void {
  let pool = IndexPool.load(event.address.toHexString());
  let swapFee = hexToDecimal(event.params.swapFee.toHexString(), 18);
  pool.swapFee = swapFee;
  pool.save();
  updateTokenPrices(pool as IndexPool);
  updateDailySnapshot(pool as IndexPool, event);
}
