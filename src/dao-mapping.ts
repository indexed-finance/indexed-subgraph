import { ProposalCreated, ProposalQueued, ProposalCanceled, ProposalExecuted } from '../generated/GovernorAlpha/GovernorAlpha';
import { Proposal, Vote, State } from '../generated/schema';
import { BigInt } from '@graphprotocol/graph-ts';

export function createProposal(event: ProposalCreated) {
  let proposal = new Proposal(event.params.metadataHash);
  let address = event.transaction.from.toHexString();
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
