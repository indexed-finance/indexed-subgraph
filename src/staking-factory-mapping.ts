import { BigInt } from "@graphprotocol/graph-ts";
import { NdxStakingPool } from "../generated/schema";
import { IndexPoolStakingRewardsAdded, StakingRewardsFactory } from "../generated/StakingRewardsFactory/StakingRewardsFactory";
import { StakingRewards } from "../generated/templates";

export function handleIndexPoolRewardsAdded(event: IndexPoolStakingRewardsAdded): void {
  StakingRewards.create(event.params.stakingRewards);
  let pool = new NdxStakingPool(event.params.stakingRewards.toHexString());
  pool.indexPool = event.params.indexPool;
  pool.stakingToken = event.params.indexPool;
  pool.isReady = false;
  pool.isWethPair = false;
  pool.totalSupply = new BigInt(0);
  pool.rewardPerTokenStored = new BigInt(0);
  pool.periodFinish = 0;
  pool.lastUpdateTime = 0;
  pool.claimedRewards = new BigInt(0);
  pool.rewardRate = new BigInt(0);
  pool.save();
}