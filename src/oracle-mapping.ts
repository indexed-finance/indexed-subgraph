import { CategoryAdded, CategorySorted, MarketOracle, TokenAdded } from '../generated/MarketOracle/MarketOracle';
import { Category, Token } from '../generated/schema';

export function handleNewCategory(event: CategoryAdded): void {
  let category = new Category(event.params.categoryID.toHex());
  category.metadataHash = event.params.metadataHash;
  category.tokens = [];
  category.indexPools = [];
  category.save();
}

export function handleTokenAdded(event: TokenAdded): void {
  let categoryID = event.params.categoryID.toHex();
  let tokenAddress = event.params.token.toHex();
  let category = Category.load(categoryID);
  let token = new Token(tokenAddress);
  token.category = categoryID;
  token.save();
  category.tokens.push(tokenAddress);
  category.save();
}

export function handleCategorySorted(event: CategorySorted): void {
  let category = Category.load(event.params.categoryID.toHex());
  let oracle = MarketOracle.bind(event.address);
  let tokens = oracle.getCategoryTokens(event.params.categoryID);
  category.tokens = tokens.map(t => t.toHex());
  category.save();
}
