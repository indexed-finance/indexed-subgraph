import { Address, ethereum, log, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { Approval } from '../../generated/GenericApproveHandler/IERC20';
import { PoolUnderlyingToken, DailyPoolSnapshot, IndexPool, Token } from "../../generated/schema";
import { convertEthToDecimal } from "../helpers/general";
import { getTokenPriceUSD } from "../helpers/pricing";
import { convertTokenToDecimal, ZERO_BD, joinHyphen } from "../helpers/general";
import { getCategoryManager } from '../helpers/categories';

function loadUnderlyingToken(poolAddress: Address, tokenAddress: Address): PoolUnderlyingToken {
  let tokenID = joinHyphen([poolAddress.toHexString(), tokenAddress.toHexString()]);
  return PoolUnderlyingToken.load(tokenID) as PoolUnderlyingToken;
}

function updateDailySnapshot(pool: IndexPool, event: ethereum.Event): void {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 3600;
  let poolDayID = pool.id
    .concat('-')
    .concat(BigInt.fromI32(dayID).toString());
  let snapshot = DailyPoolSnapshot.load(poolDayID);
  if (snapshot == null) {
    snapshot = new DailyPoolSnapshot(poolDayID);
  }

  snapshot.pool = pool.id;
  snapshot.date = dayID * 3600;

  let tokenAddresses = pool.tokensList;
  let balances = new Array<BigInt>()
  let denorms = new Array<BigInt>()
  let desiredDenorms = new Array<BigInt>()
  let tokens = new Array<Bytes>()
  let totalValueLockedUSD = ZERO_BD

  for (let i = 0; i < tokenAddresses.length; i++) {
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

export function handleApproval(event: Approval): void {
  let manager = getCategoryManager();
  let poolsList = manager.poolsList;
  log.warning('running approval with num tokens {}', [BigInt.fromI32(poolsList.length).toString()]);
  for (let i = 0; i < poolsList.length; i++) {
    let poolAddress = poolsList[i];
    let pool = IndexPool.load(poolAddress);
    log.warning('Loading pool with index {}', [poolAddress]);
    updateTokenPrices(pool as IndexPool);
    updateDailySnapshot(pool as IndexPool, event);
  }
}