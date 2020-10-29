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

  // Adding newly delegated addresses inactive balances to the active mapping
  if(event.params.fromDelegate.toHexString() == NA){
    snapshot.inactive = snapshot.inactive.minus(votes);
    snapshot.active = snapshot.active.plus(votes);
  }

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

  // Genesis mint creates the entry value in the inactive class
  if(event.params.from.toHexString() == NA){
    snapshot.inactive = snapshot.inactive.plus(value);
  } else if(condition){
    // Active addreses = delegated address == msg.sender
    // Inactive address = delegated address == address(0x0)
    // Delegated address = delegated adress != msg.sender

    // Therefore the possible outcomes need to be programmed:
    // A active address transfers to an inactive address (-active, +inactive)
    // A inactive address transfers to an active address (-inactive, +active)
    // A active address transfers to an delegated address (-active, +delegated)
    // A inactive address transfers to an delegated address (-inactive, +delegated)
    // A delegated address transfers to an active address (-delegated, +active)
    // A delegated address transfers to an inactive address (-delegated, +inactive)
    }
    snapshot.save();
  }

export function handleDelegateVoteChange(event: DelegateVotesChanged): void {
  let timestamp = event.block.timestamp.toI32();
  let contract = Ndx.bind(event.address);
  let delegate = contract.delegates(event.params.delegate);
  let snapshot = initialiseSnapshot(timestamp);
  let balance = contract.balanceOf(event.params.delegate);

  log.info('delegate: {}', [ delegate.toHexString() ])
  log.info('sender: {}', [ event.params.delegate.toHexString() ])

  // Event triggers whenever an active address (aka active or delegated) and
  // updates the delegates current mapping, this is triggered on every transfer so
  // implementing logic here can complicate logic (as you can't account for inactive).
  // As whenever someone delegates an address it also fires, but you could use
  // getPriorvotes to validte whether they had a delegated balance beforehand (aka 0 = inactive).

  snapshot.save()
}

function initialiseSnapshot(timestamp: i32): DailyDistributionSnapshot {
  let dayId = timestamp / ONE_DAY;
  let previousId = dayId - 1;
  let eventTimestamp = BigInt.fromI32(dayId);
  let previousTimestamp = BigInt.fromI32(previousId);
  let newSnapshot = DailyDistributionSnapshot.load(eventTimestamp.toString());
  let oldSnapshot = DailyDistributionSnapshot.load(previousTimestamp.toString());

  // Possible problems with this as it only creates a limited number of records
  // the idea is to find the last recorded entry (using id) for that entity
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
