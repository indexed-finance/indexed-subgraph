import { NdxContract, Transfer, DelegateChanged, DelegateVotesChanged } from '../generated/Ndx/Ndx';
import { DailyDistributionSnapshot } from '../generated/schema';
import { BigInt, Bytes } from '@graphprotocol/graph-ts';

const ONE_DAY = 86400000;
const NA = '0x0000000000000000000000000000000000000000';

export function handleDelegateChanged(event: DelegateChanged): void {
  let timestamp = event.block.timestamp.toI32();
  let snapshot = initialiseSnapshot(timestamp);
  let contract = NdxContract.bind(event.address);
  let votes = contract.getPriorVotes(event.params.delegator, event.block.number);

  if(event.params.delegatee != event.params.delegator){
    snapshot.delegated = snapshot.delegated.plus(vote);

    if(event.params.delegator == event.params.currentDelegate){
      snapshot.active = snapshot.active.minus(votes);
    } else if(event.params.currentDelegate == NA){
      snapshot.inactive = snapshot.inactive.minus(votes);
    }
  } else if(event.params.delegatee != NA) {
    snapshot.active = snapshot.active.plus(votes);

    if(event.params.currentDelegate == NA){
      snapshot.inactive = snapshot.inactive.minus(votes);
    } else if(event.params.delegator != event.params.currentDelegate){
      snapshot.delegated = snapshot.delegated.minus(votes);
    }
  } else {
    snapshot.inactive = snapshot.active.plus(votes);

    if(event.params.currentDelegate == event.params.delegator){
      snapshot.active = snapshot.active.plus(votes);
    } else {
      snapshot.delegated = snapshot.delegated.minus(votes);
    }
  }

  snapshot.save();
}

export function handleTransfer(event: Transfer): void {
  let sender = event.params.from.toHexString();
  let recipent = event.params.to.toHexString();
  let timestamp = event.block.timestamp.toI32();
  let snapshot = initialiseSnapshot(timestamp);
  let recipentDelegate = contract.delegates(recipent);
  let senderDelegate = contract.delegates(sender);
  let value = event.params.amount

  if(senderDelegate == address){
    snapshot.active = snapshot.active.minus(value)
  } else if(senderDelegate == NA){
    snapshot.inactive.sub(value)
  } if(recipentDelegate == address){
    snapshot.active = snapshot.active.plus(value)
  } else if(recipentDelegate == NA){
    snapshot.inactive.sub(value)
  }

  snapshot.save()
}

export function handleDelegateVoteChange(event: DelegateVotesChanged): void {
  let timestamp = event.block.timestamp.toI32();
  let snapshot = initialiseSnapshot(timestamp);
  let difference = BigInt.fromI32(0);

  if(event.params.oldVotes > event.params.newVotes){
    difference = event.params.oldVotes.minus(event.params.newVotes)
    difference = snapshot.delegated.minus(difference)
  } else {
    difference = event.params.newVotes.minus(event.params.oldVotes)
    difference = snapshot.delegated.plus(difference)
  }

  snapshot.save()
}


function initialiseSnapshot(timestamp: Int): DailyDistributionSnapshot {
  let eventTimestamp = new Date(timestamp * 1000)

  eventTimestamp.setSeconds(0)
  eventTimestamp.setHours(0)

  let previousTimestamp = eventTimestamp

  previousTimestamp.setTime(previousTimestamp.getTime() - ONE_DAY)

  let newTimestamp = eventTimestamp.getTime() / 1000
  let oldTimestamp = previousTimestamp.getTime() / 1000
  let newSnapshot = DailyDistributionSnapshot.load(newTimestamp)
  let oldSnapshot = DailyDistributionSnapshot.load(oldTimestamp)

  if(newSnapshot == null){
    newSnapshot = new DailyDistributionSnapshot(newTimestamp)

    if(oldSnapshot == null){
      newSnapshot.active = oldSnapshot.active
      newSnapshot.inactive = oldSnapshot.inactive
      newSnapshot.delegated = oldSnapshot.delegaed
    }
  }

  return newSnapshot
}
