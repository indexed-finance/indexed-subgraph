import { NdxContract, Transfer, DelegateChanged, DelegateVotesChanged } from '../generated/Ndx/Ndx';
import { DailyDistributionSnapshot } from '../generated/schema';
import { BigInt, Bytes } from '@graphprotocol/graph-ts';

export function handleTransfer(event: Transfer){
  let sender = event.params.from.toHexString();
  let recipent = event.params.to.toHexString();
  let timestamp = event.block.timestamp.toI32();
  let snapshot = initialiseSnapshot(timestamp);
  let recipentDelegate = contract.delegates(recipent);
  let senderDelegate = contract.delegates(sender);
  let value = event.params.amount

  if(senderDelegate == address){
    snapshot.active = snapshot.active.sub(value)
  } else if(senderDelegate == NA){
    snapshot.inactive.sub(value)
  } else {
    snapshot.delegated.sub(value)
  }  if(recipentDelegate == address){
    snapshot.active = snapshot.active.add(value)
  } else if(recipentDelegate == NA){
    snapshot.inactive.sub(value)
  } else {
    snapshot.delegated.sub(value)
  }

  snapshot.save()
}

export function handleDelegateVoteChange(event: DelegateVotesChanged){
  let contract = NdxContract.bind(event.address);


}

function initialiseSnapshot(timestamp: Int): DailyDistributionSnapshot {
  let eventTimestamp = new Date(timestamp * 1000)

  eventTimestamp.setSeconds(0)
  eventTimestamp.setHours(0)

  let previousTimestamp = eventTimestamp

  previousTimestamp.setDate(previousTimestamp.getDate() - 1)

  let newTimestamp = eventTimestamp.getTime() / 1000
  let oldTimestamp = previousTimestamp.getTime() / 1000
  let newSnapshot = DailyDistributionSnapshot.load(newTimestamp)
  let oldSnapshot = DailyDistributionSnapshot.load(oldTimestamp)

  if(newSnapshot == null){
    newSnapshot = new DailyDistributionSnapshot(newTimestamp)

    if(oldSnapshot == null){
      newSnapshot = new DailyDistributionSnapshot(newTimestamp)
      newSnapshot.active = oldSnapshot.active
      newSnapshot.inactive = oldSnapshot.inactive
      newSnapshot.delegated = oldSnapshot.delegaed
    }
  }

  return newSnapshot
}
