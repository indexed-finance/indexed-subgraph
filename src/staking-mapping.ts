import { NdxStakingPool } from "../generated/schema";
import { RewardPaid, Staked, StakingRewards, Withdrawn } from "../generated/templates/StakingRewards/StakingRewards";
import { RewardAdded } from "../generated/templates/StakingRewards/StakingRewards";

export function handleRewardAdded(event: RewardAdded): void {
  let pool = new NdxStakingPool(event.address.toHexString());
  let rewards = StakingRewards.bind(event.address);
  pool.lastUpdateTime = event.block.timestamp.toI32();
  pool.periodFinish = rewards.periodFinish().toI32();
  pool.rewardRate = rewards.rewardRate();
  pool.save();
}

export function handleStaked(event: Staked): void {
  let pool = new NdxStakingPool(event.address.toHexString());
  pool.totalSupply = pool.totalSupply.plus(event.params.amount);
  pool.save();
}

export function handleWithdrawn(event: Withdrawn): void {
  let pool = new NdxStakingPool(event.address.toHexString());
  pool.totalSupply = pool.totalSupply.minus(event.params.amount);
  pool.save();
}

export function handleRewardPaid(event: RewardPaid): void {
  let pool = new NdxStakingPool(event.address.toHexString());
  pool.claimedRewards = pool.claimedRewards.plus(event.params.reward);
  pool.save();
}