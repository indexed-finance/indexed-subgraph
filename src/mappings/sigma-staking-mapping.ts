import { BigInt } from "@graphprotocol/graph-ts";
import { NdxStakingPool } from "../../generated/schema";
import { SigmaRewardsFactory, UniswapStakingRewardsAdded } from "../../generated/SigmaRewardsFactory/SigmaRewardsFactory";
import { StakingRewards } from "../../generated/templates";

export function handleUniswapStakingRewardsAdded(event: UniswapStakingRewardsAdded): void {
  StakingRewards.create(event.params.stakingRewards);
  let pool = new NdxStakingPool(event.params.stakingRewards.toHexString());
  let factory = SigmaRewardsFactory.bind(event.address);
  let rewardsInfo = factory.stakingRewardsInfoByStakingToken(event.params.stakingToken);
  let rewardAmount = rewardsInfo.value1;
  pool.startsAt = factory.stakingRewardsGenesis().toI32();
  pool.isReady = false;
  pool.isWethPair = true;
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