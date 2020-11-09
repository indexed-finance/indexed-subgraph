import { Address, BigInt } from "@graphprotocol/graph-ts";
import { InitializerToken, PoolInitializer, TokenContribution, TokenContributor } from "../../generated/schema";
import { TokensContributed, TokensClaimed } from "../../generated/templates/PoolInitializer/PoolInitializer";
import { joinHyphen } from "../helpers/general";

function getContributor(initializerAddress: Address, accountAddress: Address): TokenContributor {
  let contributorID = joinHyphen([initializerAddress.toHexString(), accountAddress.toHexString()]);
  let contributor = TokenContributor.load(contributorID as string);
  if (contributor == null) {
    contributor = new TokenContributor(contributorID as string);
    contributor.credit = new BigInt(0);
    return contributor as TokenContributor;
  }
  return contributor as TokenContributor;
}

export function handleTokensContributed(event: TokensContributed): void {
  let initializerAddress = event.address;
  let initializer = PoolInitializer.load(initializerAddress.toHexString());
  initializer.totalCreditedWETH = initializer.totalCreditedWETH.plus(event.params.credit);
  initializer.save();
  let tokenAddress = event.params.token;
  let tokenID = initializerAddress
    .toHexString()
    .concat('-')
    .concat(tokenAddress.toHexString());
  let token = InitializerToken.load(tokenID);
  token.balance = token.balance.plus(event.params.amount);
  token.amountRemaining = token.amountRemaining.minus(event.params.amount);
  token.save();

  let contributor = getContributor(event.address, event.transaction.from);
  contributor.credit = contributor.credit.plus(event.params.credit);
  contributor.save();

  let txHash = event.transaction.hash;
  let contributionID = initializerAddress
    .toHexString()
    .concat('-')
    .concat(txHash.toHexString());
  let contribution = new TokenContribution(contributionID);
  contribution.token = tokenAddress.toHexString();
  contribution.caller = event.transaction.from;
  contribution.amount = event.params.amount;
  contribution.credit = event.params.credit;
  contribution.transactionHash = txHash;
  contribution.timestamp = event.block.timestamp.toI32() as i32;
  contribution.save();
}

export function handleTokensClaimed(event: TokensClaimed): void {
  let contributor = getContributor(event.address, event.transaction.from);
  contributor.credit = BigInt.fromI32(0);
  contributor.save();
}