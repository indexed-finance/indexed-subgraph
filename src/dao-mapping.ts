import { ProposalCreated, ProposalQueued, ProposalCanceled, ProposalExecuted } from '../generated/GovernorAlpha/GovernorAlpha';
import { Proposal, Vote, State } from '../generated/schema';
import { BigInt, Bytes } from '@graphprotocol/graph-ts';

export function createProposal(event: ProposalCreated) {
  let address = event.transaction.from.toHexString();
  let proposal = new Proposal(event.params.id);
  
  proposal.against = event.params.againstVotes;
  proposal.signatures = event.params.signatures;
  proposal.calldatas = event.params.calldatas;
  proposal.targets = event.params.targets;
  propsoal.expiry = event.params.endBlock;
  proposal.values = event.params.values;
  proposal.for = event.params.forVotes;
  proposal.state = State.Active;
  proposal.proposer = address;
  proposal.save();
}

export function cancelProposal(event: ProposalCanceled) {
  manageProposal(event.params.id, event.transaction.hash.toHex(), State.Cancelled)
}

export function queueProposal(event: ProposalQueued) {
  manageProposal(event.params.id, event.transaction.hash.toHex(), State.Queued)
}

export function executeProposal(event: ProposalCanceled) {
  manageProposal(event.params.id, event.transaction.hash.toHex(), State.Executed)
}

function manageProposal(id: string, transactionHash: Bytes, state: State) {
  let proposal = Proposal.load(id)

  proposal.action = transactionHash
  proposal.state = state
  proposal.save()
}
