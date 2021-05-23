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
      snapshot.voters++;
    } else if (to == NA){
      snapshot.inactive = snapshot.inactive.plus(votes);
      snapshot.voters--;
    } else if (from == delegator){
      snapshot.delegated = snapshot.delegated.plus(votes);
      snapshot.active = snapshot.active.minus(votes);
    }
  }

  snapshot.save();
}

export function handleTransfer(event: Transfer): void {
  let timestamp = event.block.timestamp.toI32();
  let block = event.block.number.toI32();
  let contract = Ndx.bind(event.address);
  let snapshot = initialiseSnapshot(timestamp);
  let recipentDelegate = contract.delegates(event.params.to);
  let senderDelegate = contract.delegates(event.params.from);
  let isSenderActive = event.params.from == senderDelegate;
  let isRecipentActive = event.params.to == recipentDelegate;
  let recipentWeight = contract.getCurrentVotes(event.params.to);
  let senderWeight = contract.getCurrentVotes(event.params.from);
  let senderBalance = contract.balanceOf(event.params.from);
  let recipentPreviousWeight = contract.getPriorVotes(event.params.to, BigInt.fromI32(block - 1));
  let senderPreviousWeight = contract.getPriorVotes(event.params.from, BigInt.fromI32(block - 1));
  let recipentBalance = contract.balanceOf(event.params.to);
  let recipentDelegatedWeight = recipentWeight.minus(recipentBalance);
  let senderDelegatedWeight = senderWeight.minus(senderBalance);
  let senderActiveWeight = senderBalance.minus(senderDelegatedWeight);
  let recipentActiveWeight = recipentBalance.minus(recipentDelegatedWeight);
  let notEqual = event.params.from.toHexString() != event.params.to.toHexString();
  let value = event.params.amount;
  let BN_ZERO = BigInt.fromI32(0);

  if(event.params.from.toHexString() == NA){
    snapshot.inactive = snapshot.inactive.plus(value);
  } else if(notEqual){
    if(event.params.to.toHexString() == NA){
      snapshot.inactive = snapshot.inactive.plus(value);
    } else if(event.params.from.toHexString() == NA) {
      snapshot.inactive = snapshot.inactive.minus(value);
    } else {
      if(recipentDelegatedWeight > BN_ZERO) {
        let previousBalance = recipentBalance.minus(value);
        let previousActiveWeight = recipentPreviousWeight.minus(previousBalance);
        let previousDelegatedWeight = recipentPreviousWeight.minus(previousActiveWeight);
        let totalWeightDifferece = recipentWeight.minus(recipentPreviousWeight);
        let weightDifference = recipentDelegatedWeight.minus(previousDelegatedWeight);

        snapshot.delegated = snapshot.delegated.minus(totalWeightDifferece.plus(weightDifference));
        snapshot.active = snapshot.active.minus(totalWeightDifferece.plus(value));
      } if(senderDelegatedWeight > BN_ZERO) {
        let previousBalance = senderBalance.plus(value);
        let previousActiveWeight = senderPreviousWeight.minus(previousBalance);
        let previousDelegatedWeight = senderPreviousWeight.minus(previousActiveWeight);
        let totalWeightDifferece = senderPreviousWeight.minus(senderWeight);
        let weightDifference = previousDelegatedWeight.minus(senderDelegatedWeight);

        snapshot.delegated = snapshot.delegated.plus(totalWeightDifferece.plus(weightDifference));
        snapshot.active = snapshot.active.plus(totalWeightDifferece.plus(value));
      }
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
  let weightDifference = BigInt.fromI32(0);
  let snapshot = initialiseSnapshot(timestamp);
  let delegate = contract.delegates(caller);
  let isActive = delegate.toHexString() == caller.toHexString();
  let result = isActive ? 'true' : 'false';
  let balance = contract.balanceOf(caller);
  let previousVotes = contract.getPriorVotes(
    caller, BigInt.fromI32(block - 1)
  );
  let currentVotes = contract.getCurrentVotes(caller);
  let BN_ZERO =  BigInt.fromI32(0);

  if(isActive){
    if(previousVotes == BN_ZERO){
      snapshot.active = snapshot.active.plus(newBalance);
    } else if(currentVotes.minus(balance) > BN_ZERO){
      if(prevBalance <= newBalance){
        weightDifference = newBalance.minus(prevBalance);
        snapshot.delegated = snapshot.delegated.plus(weightDifference);
        snapshot.active = snapshot.active.plus(weightDifference);
      } else {
        weightDifference = prevBalance.minus(newBalance);
        snapshot.delegated = snapshot.delegated.minus(weightDifference);
        snapshot.active = snapshot.active.minus(weightDifference);
      }
    } else if(prevBalance <= newBalance){
      weightDifference = newBalance.minus(prevBalance);
      snapshot.active = snapshot.active.plus(weightDifference);
    } else {
      weightDifference = prevBalance.minus(newBalance);
      snapshot.active = snapshot.active.minus(weightDifference);
    }
  } else {
    if(prevBalance <= newBalance){
      weightDifference = newBalance.minus(prevBalance);
      snapshot.delegated = snapshot.delegated.plus(weightDifference);
    } else {
      weightDifference = prevBalance.minus(newBalance);
      snapshot.delegated = snapshot.delegated.minus(weightDifference);
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
      newSnapshot.voters = oldSnapshot.voters;
    } else {
      newSnapshot = new DailyDistributionSnapshot(eventTimestamp.toString());
      newSnapshot.active = BigInt.fromI32(0);
      newSnapshot.inactive = BigInt.fromI32(0);
      newSnapshot.delegated = BigInt.fromI32(0);
      newSnapshot.voters = 0;
    }
    newSnapshot.save()
  }

  return newSnapshot as DailyDistributionSnapshot;
}
