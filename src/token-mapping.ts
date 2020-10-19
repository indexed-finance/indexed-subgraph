import { Ndx, Transfer, DelegateChanged, DelegateVotesChanged } from '../generated/Ndx/Ndx';
import { DailyDistributionSnapshot } from '../generated/schema';
import { BigInt, Bytes, Address } from '@graphprotocol/graph-ts';

const ONE_DAY = 86400;
const NA = '0x0000000000000000000000000000000000000000';

export function handleDelegateChanged(event: DelegateChanged): void {
  let timestamp = event.block.timestamp.toI32();
  let snapshot = initialiseSnapshot(timestamp);
  let contract = Ndx.bind(event.address);
  let votes = contract.getPriorVotes(event.params.delegator, event.block.number.minus(BigInt.fromI32(1)));
  let delegate = contract.delegates(event.params.delegator);

  if(event.params.fromDelegate.toHexString() == NA){
    snapshot.inactive = snapshot.inactive.minus(votes);
  }

  snapshot.save();
}

export function handleTransfer(event: Transfer): void {
  let timestamp = event.block.timestamp.toI32();
  let contract = Ndx.bind(event.address);
  let snapshot = initialiseSnapshot(timestamp);
  let recipentDelegate = contract.delegates(event.params.to);
  let senderDelegate = contract.delegates(event.params.from);
  let value = event.params.amount;

  if(event.params.from.toHexString() == NA){
    snapshot.inactive = snapshot.inactive.minus(value);
  }

  snapshot.save();
}

export function handleDelegateVoteChange(event: DelegateVotesChanged): void {
  let timestamp = event.block.timestamp.toI32();
  let contract = Ndx.bind(event.address);
  let delegate = contract.delegates(event.params.delegate);
  let snapshot = initialiseSnapshot(timestamp);
  let difference = BigInt.fromI32(0);

  if(delegate != event.params.delegate && delegate.toHexString() != NA){
    if(event.params.previousBalance > event.params.newBalance){
      difference = event.params.previousBalance.minus(event.params.newBalance);
      difference = snapshot.delegated.minus(difference);
    } else {
      difference = event.params.newBalance.minus(event.params.previousBalance);
      difference = snapshot.delegated.plus(difference);
    }
    snapshot.delegated = difference;
  } else if(delegate == event.params.delegate && delegate.toHexString() != NA) {
    if(event.params.previousBalance > event.params.newBalance){
      difference = event.params.previousBalance.minus(event.params.newBalance);
      difference = snapshot.active.minus(difference);
    } else {
      difference = event.params.newBalance.minus(event.params.previousBalance);
      difference = snapshot.active.plus(difference);
    }
    snapshot.active = difference;
  } else {
    if(event.params.previousBalance > event.params.newBalance){
      difference = event.params.previousBalance.minus(event.params.newBalance);
      difference = snapshot.inactive.minus(difference);
    } else {
      difference = event.params.newBalance.minus(event.params.previousBalance);
      difference = snapshot.inactive.plus(difference);
    }
    snapshot.inactive = difference;
  }

  snapshot.save()
}

function initialiseSnapshot(timestamp: i32): DailyDistributionSnapshot {
  let dayId = timestamp / ONE_DAY;
  let previousId = dayId - 1;
  let eventTimestamp = BigInt.fromI32(dayId);
  let previousTimestamp = BigInt.fromI32(previousId);
  let newSnapshot = DailyDistributionSnapshot.load(eventTimestamp.toString());
  let oldSnapshot = DailyDistributionSnapshot.load(previousTimestamp.toString());

  for(let x = 1; x < 14; x++){
    if(oldSnapshot != null) break;

    previousId = previousId - x;
    previousTimestamp = BigInt.fromI32(previousId);
    oldSnapshot = DailyDistributionSnapshot.load(previousTimestamp.toString());
  } if(newSnapshot == null){
    if(oldSnapshot != null){
      dayId = previousId + 1;
      eventTimestamp = BigInt.fromI32(dayId);
      newSnapshot = new DailyDistributionSnapshot(eventTimestamp.toString());
      newSnapshot.active = oldSnapshot.active;
      newSnapshot.inactive = oldSnapshot.inactive;
      newSnapshot.delegated = oldSnapshot.delegated;
    } else {
      newSnapshot = new DailyDistributionSnapshot(eventTimestamp.toString());
      newSnapshot.active = BigInt.fromI32(0);
      newSnapshot.inactive = BigInt.fromI32(0);
      newSnapshot.delegated = BigInt.fromI32(0);
    }
    newSnapshot.save()
  }

  return newSnapshot as DailyDistributionSnapshot;
}
