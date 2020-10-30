import { NdxStakingPool } from "../generated/schema";
import { RewardPaid, Staked, StakingRewards, Withdrawn } from "../generated/templates/StakingRewards/StakingRewards";
import { RewardAdded } from "../generated/templates/StakingRewards/StakingRewards";

import { BigInt, Address } from "@graphprotocol/graph-ts";

export function handleRewardAdded(event: RewardAdded): void {
  let pool = intialisePool(event.address, event.block.timestamp);

  pool.isReady = true;
  pool.save();
}

export function handleStaked(event: Staked): void {
  let pool = intialisePool(event.address, event.block.timestamp);

  pool.totalSupply = pool.totalSupply.plus(event.params.amount);
  pool.save();
}

export function handleWithdrawn(event: Withdrawn): void {
  let pool = intialisePool(event.address, event.block.timestamp);

  pool.totalSupply = pool.totalSupply.minus(event.params.amount);
  pool.save();
}

export function handleRewardPaid(event: RewardPaid): void {
  let pool = intialisePool(event.address, event.block.timestamp);

  pool.claimedRewards = pool.claimedRewards.plus(event.params.reward);
  pool.save();
}

function intialisePool(address: Address, timestamp: BigInt): NdxStakingPool {
  let pool = NdxStakingPool.load(address.toHexString());
  let rewards = StakingRewards.bind(address);

  if(pool == null){
    let pool = new NdxStakingPool(address.toHexString());
    pool.claimedRewards = BigInt.fromI32(0);
    pool.totalSupply = BigInt.fromI32(0);
    pool.isReady = true;
  }

  pool.lastUpdateTime = timestamp.toI32();
  pool.periodFinish = rewards.periodFinish().toI32();
  pool.rewardRate = rewards.rewardRate();
  pool.save();

  return pool as NdxStakingPool;
}
