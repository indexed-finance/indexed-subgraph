import { ProposalCreated, ProposalQueued, ProposalCanceled, ProposalExecuted, VoteCast } from '../generated/GovernorAlpha/GovernorAlpha';
import { Proposal, Vote } from '../generated/schema';
import { BigInt, Bytes, Address } from '@graphprotocol/graph-ts';

export function createProposal(event: ProposalCreated): void {
  let proposal = new Proposal(event.params.id.toHexString());

  proposal.proposer = event.transaction.from;
  proposal.targets = event.params.targets as Array<Bytes>;
  proposal.calldatas = event.params.calldatas as Array<Bytes>;
  proposal.signatures = event.params.signatures as Array<String>;
  proposal.values = event.params.values as Array<BigInt>;
  proposal.expiry = event.params.endBlock.toI32();
  proposal.votes = new Array<String>();
  proposal.against = BigInt.fromI32(0);
  proposal.for = BigInt.fromI32(0);
  proposal.state = "0";

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
  manageProposal(event.params.id.toHexString(), event.transaction.hash, "1");
}

export function queueProposal(event: ProposalQueued): void {
  manageProposal(event.params.id.toHexString(), event.transaction.hash, "2");
}

export function executeProposal(event: ProposalExecuted): void {
  manageProposal(event.params.id.toHexString(), event.transaction.hash, "3");
}

function manageProposal(id: string, transactionHash: Bytes, state: String): void {
  let proposal = Proposal.load(id);

  proposal.action = transactionHash;
  proposal.state = state;
  proposal.save();
}
