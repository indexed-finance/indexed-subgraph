import { LOG_NEW_POOL } from '../generated/PoolController/PoolController';
import { Category, IndexPool, PoolUnderlyingToken } from '../generated/schema';
import { BPool } from '../generated/templates';
import { BPool as BPoolContract } from '../generated/templates/BPool/BPool';

export function handleNewPool(event: LOG_NEW_POOL): void {
  let categoryID = event.params.categoryID.toHex();
  let poolAddress = event.params.pool;
  // Start tracking the new pool contract
  BPool.create(poolAddress);
  let bpool = BPoolContract.bind(poolAddress);
  // Create the IndexPool entity.
  let pool = new IndexPool(poolAddress.toHex());
  pool.category = categoryID;
  pool.size = event.params.indexSize;
  pool.tokens = [];
  pool.totalWeight = bpool.getTotalDenormalizedWeight();
  // Create PoolUnderlyingToken entities and add them to the IndexPool
  let tokens = bpool.getCurrentTokens();
  for (let tokenAddress of tokens) {
    let record = bpool.getTokenRecord(tokenAddress);
    let tokenID = poolAddress.toHex() + '-' + tokenAddress.toHex();
    let token = new PoolUnderlyingToken(tokenID);
    token.token = tokenAddress.toHex();
    token.denorm = record.denorm;
    token.desiredDenorm = record.desiredDenorm;
    token.balance = record.balance;
    token.save();
    pool.tokens.push(tokenID);
  }
  pool.save();
}