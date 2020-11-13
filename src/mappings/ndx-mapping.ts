import { Ndx, Transfer, DelegateChanged, DelegateVotesChanged } from '../../generated/Ndx/Ndx';
import { DailyDistributionSnapshot } from '../../generated/schema';
import { BigInt, Bytes, Address, log } from '@graphprotocol/graph-ts';

const ONE_DAY = 86400;
const NA = '0x0000000000000000000000000000000000000000';

export function handleDelegateChanged(event: DelegateChanged): void {
  let timestamp = event.block.timestamp.toI32();
  let snapshot = initialiseSnapshot(timestamp);
  let to = event.params.toDelegate.toHexString();
  let from = event.params.fromDelegate.toHexString();
  let delegator = event.params.delegator.toHexString();
  let contract = Ndx.bind(event.address);
  let votes = contract.balanceOf(event.params.delegator);

  if(from != to){
    if(from == NA){
      snapshot.inactive = snapshot.inactive.minus(votes);
    } else if(to == NA){
      snapshot.inactive = snapshot.inactive.plus(votes);
    }
  }

  snapshot.save();
}

export function handleTransfer(event: Transfer): void {
  let timestamp = event.block.timestamp.toI32();
  let value = event.params.amount;

  let contract = Ndx.bind(event.address);
  let snapshot = initialiseSnapshot(timestamp);
  let recipentDelegate = contract.delegates(event.params.to);
  let senderDelegate = contract.delegates(event.params.from);
  let sender = senderDelegate.toHexString();
  let recipent = recipentDelegate.toHexString();
  let notEqual = sender != recipent;

  if(event.params.from.toHexString() == NA){
    snapshot.inactive = snapshot.inactive.plus(value);
  } else if(notEqual){
    if(recipent == NA){
      snapshot.inactive = snapshot.inactive.plus(value);
    } else if(sender == NA) {
      snapshot.inactive = snapshot.inactive.minus(value);
    }
  }
  snapshot.save();
}

export function handleDelegateVoteChange(event: DelegateVotesChanged): void {
  let timestamp = event.block.timestamp.toI32();
  let prevBalance = event.params.previousBalance;
  let newBalance = event.params.newBalance;
  let block = event.block.number.toI32();
  let contract = Ndx.bind(event.address);
  let caller = event.params.delegate;
  let difference = BigInt.fromI32(0);

  let snapshot = initialiseSnapshot(timestamp);
  let delegate = contract.delegates(caller);
  let isActive = delegate.toHexString() == caller.toHexString();
  let result = isActive ? 'true' : 'false';
  let balance = contract.balanceOf(caller);
  let votes = contract.getPriorVotes(
    caller, BigInt.fromI32(block - 1)
  );

  if(votes == BigInt.fromI32(0) && isActive){
    snapshot.active = snapshot.active.plus(balance);
  } else {
    if(isActive){
      if(prevBalance > newBalance){
        difference = prevBalance.minus(newBalance);
        difference = snapshot.active.minus(difference);
      } else {
        difference = newBalance.minus(prevBalance);
        difference = snapshot.active.plus(difference);
      }
      snapshot.active = difference;
    } else {
      if(prevBalance > newBalance){
        difference = prevBalance.minus(newBalance);
        difference = snapshot.delegated.minus(difference);
      } else {
        difference = newBalance.minus(prevBalance);
        difference = snapshot.delegated.plus(difference);
      }
      snapshot.delegated = difference;
    }
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

  if(newSnapshot == null){
    for(let x = 1; x < 14; x++){
      if(oldSnapshot == null){
        previousId = previousId - x;
        previousTimestamp = BigInt.fromI32(previousId);
        oldSnapshot = DailyDistributionSnapshot.load(previousTimestamp.toString());
      }
    }
    if(oldSnapshot != null){
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