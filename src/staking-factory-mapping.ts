import { BigInt } from "@graphprotocol/graph-ts";
import { NdxStakingPool } from "../generated/schema";
import { IndexPoolStakingRewardsAdded, StakingRewardsFactory, UniswapStakingRewardsAdded } from "../generated/StakingRewardsFactory/StakingRewardsFactory";
import { StakingRewards } from "../generated/templates";

export function handleIndexPoolRewardsAdded(event: IndexPoolStakingRewardsAdded): void {
  StakingRewards.create(event.params.stakingRewards);
  let pool = new NdxStakingPool(event.params.stakingRewards.toHexString());
  let factory = StakingRewardsFactory.bind(event.address);
  let rewardsInfo = factory.stakingRewardsInfoByStakingToken(event.params.stakingToken);
  let rewardAmount = rewardsInfo.value2;
  pool.isReady = false;
  pool.isWethPair = false;
  pool.indexPool = event.params.stakingToken;
  pool.stakingToken = event.params.stakingToken;
  pool.totalSupply = new BigInt(0);
  pool.rewardPerTokenStored = new BigInt(0);
  pool.periodFinish = 0;
  pool.lastUpdateTime = 0;
  pool.totalRewards = rewardAmount;
  pool.claimedRewards = new BigInt(0);
  pool.rewardRate = new BigInt(0);
  pool.save();
}

export function handleUniswapStakingRewardsAdded(event: UniswapStakingRewardsAdded): void {
  StakingRewards.create(event.params.stakingRewards);
  let pool = new NdxStakingPool(event.params.stakingRewards.toHexString());
  let factory = StakingRewardsFactory.bind(event.address);
  let rewardsInfo = factory.stakingRewardsInfoByStakingToken(event.params.stakingToken);
  let rewardAmount = rewardsInfo.value2;
  pool.isReady = false;
  pool.isWethPair = false;
  pool.indexPool = event.params.indexPool;
  pool.stakingToken = event.params.stakingToken;
  pool.totalSupply = new BigInt(0);
  pool.rewardPerTokenStored = new BigInt(0);
  pool.periodFinish = 0;
  pool.lastUpdateTime = 0;
  pool.totalRewards = rewardAmount;
  pool.claimedRewards = new BigInt(0);
  pool.rewardRate = new BigInt(0);
  pool.save();
}