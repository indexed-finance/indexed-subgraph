import { ProposalCreated, ProposalQueued, ProposalCanceled, ProposalExecuted, VoteCast } from '../generated/GovernorAlpha/GovernorAlpha';
import { Proposal, Vote } from '../generated/schema';
import { BigInt, Bytes } from '@graphprotocol/graph-ts';

enum State {
  Active,
  Cancelled,
  Rejected,
  Accepted,
  Queued,
  Executed
}

export function createProposal(event: ProposalCreated): void {
  let proposal = new Proposal(event.params.id.toHexString());

  proposal.proposer = event.transaction.from;
  proposal.signatures = event.params.signatures as Array<Bytes>;
  proposal.calldatas = event.params.calldatas as Array<Bytes>;
  proposal.values = event.params.values as Array<Bytes>;
  proposal.targets = event.params.targets as Array<Bytes>;
  proposal.expiry = event.params.endBlock.toI32();
  proposal.against = BigInt.fromI32(0);
  proposal.for = BigInt.fromI32(0);
  proposal.state = State.Active as String
  proposal.save();
}

export function handleVote(event: VoteCast): void {
  let proposal = Proposal.load(event.params.proposalId.toHexString());
  let vote = new Vote(event.transaction.hash.toHex());

  vote.weight = event.params.votes;
  vote.option = event.params.support;
  vote.voter = event.transaction.from;
  vote.save();

  if(!event.params.support){
    proposal.against = event.params.votes.plus(proposal.against);
  } else {
    proposal.for = event.params.votes.minus(proposal.for);
  }

  proposal.votes.push(vote.id);
  proposal.save();
}

export function cancelProposal(event: ProposalCanceled): void {
  manageProposal(event.params.id.toHexString(), event.transaction.hash, State.Cancelled);
}

export function queueProposal(event: ProposalQueued): void {
  manageProposal(event.params.id.toHexString(), event.transaction.hash, State.Queued);
}

export function executeProposal(event: ProposalCanceled): void {
  manageProposal(event.params.id.toHexString(), event.transaction.hash, State.Executed);
}

function manageProposal(id: string, transactionHash: Bytes, state: State): void {
  let proposal = Proposal.load(id);

  proposal.action = transactionHash;
  proposal.state = state as String;
  proposal.save();
}
