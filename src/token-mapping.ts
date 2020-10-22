import { Ndx, Transfer, DelegateChanged, DelegateVotesChanged } from '../generated/Ndx/Ndx';
import { DailyDistributionSnapshot } from '../generated/schema';
import { BigInt, Bytes, Address, log } from '@graphprotocol/graph-ts';

const ONE_DAY = 86400;
const NA = '0x0000000000000000000000000000000000000000';

export function handleDelegateChanged(event: DelegateChanged): void {
  let timestamp = event.block.timestamp.toI32();
  let snapshot = initialiseSnapshot(timestamp);
  let contract = Ndx.bind(event.address);
  let votes = contract.balanceOf(event.params.delegator);

  snapshot.save();
}

export function handleTransfer(event: Transfer): void {
  let timestamp = event.block.timestamp.toI32();
  let contract = Ndx.bind(event.address);
  let snapshot = initialiseSnapshot(timestamp);
  let recipentDelegate = contract.delegates(event.params.to);
  let senderDelegate = contract.delegates(event.params.from);
  let condition = senderDelegate.toHexString() != recipentDelegate.toHexString()
  let value = event.params.amount;
  let result = condition ? 'true' : 'false'

  log.info('sender: {}', [ senderDelegate.toHexString() ])
  log.info('from: {}', [ event.params.from.toHexString() ])
  log.info('amount: {}', [ value.toString() ])
  log.info('condition: {}', [ result ])
  log.info('id: {}', [ snapshot.id ])

  if(event.params.from.toHexString() == NA){
    snapshot.inactive = snapshot.inactive.plus(value);
    snapshot.save();
  } else if(condition){
    if(senderDelegate.toHexString() == NA){
      snapshot.inactive = snapshot.inactive.minus(value);

      log.info('case: {}', [ '1' ])

      if(recipentDelegate.toHexString() != event.params.to.toHexString()){
        snapshot.delegated = snapshot.delegated.plus(value);
      } else {
        snapshot.active = snapshot.active.plus(value);
      }
      snapshot.save();
    } else if(senderDelegate.toHexString() == event.params.from.toHexString()) {
      snapshot.active = snapshot.active.minus(value);

      log.info('case: {}', [ '2' ])

      if(recipentDelegate.toHexString() == NA){
        snapshot.inactive = snapshot.inactive.plus(value);
      } else if(recipentDelegate.toHexString() != event.params.to.toHexString()){
        snapshot.delegated = snapshot.delegated.plus(value);
      }
      snapshot.save();
    }
  }
}

export function handleDelegateVoteChange(event: DelegateVotesChanged): void {
  let timestamp = event.block.timestamp.toI32();
  let contract = Ndx.bind(event.address);
  let delegate = contract.delegates(event.params.delegate);
  let snapshot = initialiseSnapshot(timestamp);
  let difference = BigInt.fromI32(0);
  let balance = contract.balanceOf(event.params.delegate);

  log.info('delegate: {}', [ delegate.toHexString() ])
  log.info('sender: {}', [ event.params.delegate.toHexString() ])

  if(event.params.previousBalance == BigInt.fromI32(0)){
    if(event.params.newBalance <= snapshot.inactive) {
      snapshot.inactive = snapshot.inactive.minus(event.params.newBalance);
      snapshot.active = snapshot.active.plus(event.params.newBalance);
    } else {
      snapshot.inactive = snapshot.inactive.plus(event.params.newBalance);
      snapshot.active = snapshot.active.minus(event.params.newBalance);
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
