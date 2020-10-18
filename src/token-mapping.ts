import { Ndx, Transfer, DelegateChanged, DelegateVotesChanged } from '../generated/Ndx/Ndx';
import { DailyDistributionSnapshot } from '../generated/schema';
import { BigInt, Bytes, Address } from '@graphprotocol/graph-ts';

const ONE_DAY = 86400000;
const NA = '0x0000000000000000000000000000000000000000';

export function handleDelegateChanged(event: DelegateChanged): void {
  let timestamp = event.block.timestamp.toI32();
  let snapshot = initialiseSnapshot(timestamp);
  let contract = Ndx.bind(event.address);
  let votes = contract.getPriorVotes(event.params.delegator, event.block.number);

  if(event.params.toDelegate != event.params.delegator){
    snapshot.delegated = snapshot.delegated.plus(votes);

    if(event.params.delegator == event.params.fromDelegate){
      snapshot.active = snapshot.active.minus(votes);
    } else if(event.params.fromDelegate.toHexString() == NA){
      snapshot.inactive = snapshot.inactive.minus(votes);
    }
  } else if(event.params.toDelegate.toHexString() != NA) {
    snapshot.active = snapshot.active.plus(votes);

    if(event.params.fromDelegate.toHexString() == NA){
      snapshot.inactive = snapshot.inactive.minus(votes);
    } else if(event.params.delegator != event.params.fromDelegate){
      snapshot.delegated = snapshot.delegated.minus(votes);
    }
  } else {
    snapshot.inactive = snapshot.active.plus(votes);

    if(event.params.fromDelegate == event.params.delegator){
      snapshot.active = snapshot.active.plus(votes);
    } else {
      snapshot.delegated = snapshot.delegated.minus(votes);
    }
  }

  snapshot.save();
}

export function handleTransfer(event: Transfer): void {
  let timestamp = event.block.timestamp.toI32();
  let contract = Ndx.bind(event.address);
  let snapshot = initialiseSnapshot(timestamp);
  let recipentDelegate = contract.delegates(event.params.from);
  let senderDelegate = contract.delegates(event.params.to);
  let value = event.params.amount

  if(senderDelegate == event.params.from){
    snapshot.active = snapshot.active.minus(value)
  } else if(senderDelegate.toHexString() == NA){
    snapshot.inactive.minus(value)
  } if(recipentDelegate == event.params.from){
    snapshot.active = snapshot.active.plus(value)
  } else if(recipentDelegate.toHexString() == NA){
    snapshot.inactive.minus(value)
  }

  snapshot.save()
}

export function handleDelegateVoteChange(event: DelegateVotesChanged): void {
  let timestamp = event.block.timestamp.toI32();
  let snapshot = initialiseSnapshot(timestamp);
  let difference = BigInt.fromI32(0);

  if(event.params.previousBalance > event.params.newBalance){
    difference = event.params.previousBalance.minus(event.params.newBalance)
    difference = snapshot.delegated.minus(difference)
  } else {
    difference = event.params.newBalance.minus(event.params.previousBalance)
    difference = snapshot.delegated.plus(difference)
  }

  snapshot.save()
}

function initialiseSnapshot(timestamp: i32): DailyDistributionSnapshot {
  let eventTimestamp = new Date(timestamp * 1000)

  eventTimestamp.setSeconds(0)
  eventTimestamp.setHours(0)

  let previousTimestamp = eventTimestamp

  previousTimestamp.setTime(previousTimestamp.getTime() - ONE_DAY)

  let newTimestamp = eventTimestamp.getTime() / 1000 as String
  let oldTimestamp = previousTimestamp.getTime() / 1000 as String
  let newSnapshot = DailyDistributionSnapshot.load(newTimestamp)
  let oldSnapshot = DailyDistributionSnapshot.load(oldTimestamp)

  if(newSnapshot == null){
    newSnapshot = new DailyDistributionSnapshot(newTimestamp)

    if(oldSnapshot != null){
      newSnapshot.active = oldSnapshot.active
      newSnapshot.inactive = oldSnapshot.inactive
      newSnapshot.delegated = oldSnapshot.delegated
    } else {
      newSnapshot.active = BigInt.fromI32(0);
      newSnapshot.inactive = BigInt.fromI32(0);
      newSnapshot.delegated = BigInt.fromI32(0);
    }
  }

  return newSnapshot as DailyDistributionSnapshot
}
