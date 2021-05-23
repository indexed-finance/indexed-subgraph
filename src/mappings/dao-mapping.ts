import { ProposalCreated, ProposalQueued, ProposalCanceled, ProposalExecuted, VoteCast, GovernorAlpha } from '../../generated/GovernorAlpha/GovernorAlpha';
import { Timelock } from '../../generated/GovernorAlpha/Timelock';
import { Proposal, Vote } from '../../generated/schema';
import { BigInt, Bytes, Address } from '@graphprotocol/graph-ts';

export function createProposal(event: ProposalCreated): void {
  let proposal = new Proposal(event.params.id.toHexString());
  let title = proposal.description.substring(0, 35)

  proposal.startBlock = event.block.number;
  proposal.proposer = event.transaction.from;
  proposal.targets = event.params.targets as Array<Bytes>;
  proposal.calldatas = event.params.calldatas as Array<Bytes>;
  proposal.signatures = event.params.signatures as Array<String>;
  proposal.description = event.params.description as String;
  proposal.values = event.params.values as Array<BigInt>;
  proposal.expiry = event.params.endBlock.toI32();
  proposal.votes = new Array<String>();
  proposal.against = BigInt.fromI32(0);
  proposal.for = BigInt.fromI32(0);
  proposal.title = title as String;
  proposal.state = "0";

  proposal.save();
}

export function handleVote(event: VoteCast): void {
  let proposalId = event.params.proposalId.toHexString();
  let transactionHash = event.transaction.hash.toHex()
  let proposal = Proposal.load(proposalId);
  let vote = new Vote(transactionHash);
  let votes = proposal.votes

  vote.weight = event.params.votes;
  vote.option = event.params.support;
  vote.voter = event.transaction.from;

  vote.save();
  votes.push(transactionHash);

  if(event.params.support){
    proposal.for = proposal.for.plus(event.params.votes);
  } else {
    proposal.against = proposal.against.plus(event.params.votes);
  }

  proposal.votes = votes;
  proposal.save();
}

export function cancelProposal(event: ProposalCanceled): void {
  manageProposal(event.params.id.toHexString(), event.transaction.hash, "1");
}

export function queueProposal(event: ProposalQueued): void {
  let gov = GovernorAlpha.bind(event.address);
  let timelock = Timelock.bind(gov.timelock());
  let delay = timelock.delay();
  let proposal = Proposal.load(event.params.id.toHexString());
  proposal.eta = event.block.timestamp.plus(delay).toI32();
  proposal.action = event.transaction.hash;
  proposal.state = "2";
  proposal.save();
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
