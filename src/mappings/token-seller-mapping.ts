import { Address, BigInt } from "@graphprotocol/graph-ts";
import { TokenForSale, TokenSeller } from "../../generated/schema";
import { NewTokensToSell, PremiumPercentSet, SwappedTokens } from "../../generated/templates/UnboundTokenSeller/UnboundTokenSeller";

function joinHyphen(a: Address, b: Address): string {
  return a.toHexString().concat('-').concat(b.toHexString());
}

function loadTokenToSell(
  sellerAddress: Address,
  tokenAddress: Address
): TokenForSale {
  let tokenID = joinHyphen(sellerAddress, tokenAddress);
  let token = TokenForSale.load(tokenID);
  if (token != null) return token as TokenForSale;
  token = new TokenForSale(tokenID);
  token.tokenSeller = sellerAddress.toHexString();
  token.token = tokenAddress.toHexString();
  token.amount = new BigInt(0);
  return token as TokenForSale;
}

export function handlePremiumSet(event: PremiumPercentSet): void {
  let seller = TokenSeller.load(event.address.toHexString());
  seller.premium = event.params.premium;
  seller.save();
}

export function handleNewTokensToSell(event: NewTokensToSell): void {
  let sellerAddress = event.address;
  let tokenAddress = event.params.token;
  let token = loadTokenToSell(sellerAddress, tokenAddress);
  token.amount = event.params.amountReceived;
  token.save();
}

export function handleTokenSwap(event: SwappedTokens): void {
  let token = loadTokenToSell(event.address, event.params.tokenSold);
  token.amount = token.amount.minus(event.params.soldAmount);
  token.save();
}