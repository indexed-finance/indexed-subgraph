import {
  IndexPool,
  PoolUnderlyingToken,
  PoolInitializer as Initializer,
  InitializerToken,
  TokenSeller
} from '../generated/schema';
import { CategoryAdded, CategorySorted, MarketCapSqrtController, TokenAdded } from '../generated/MarketCapSqrtController/MarketCapSqrtController';
import { Category, Token } from '../generated/schema';

import { IPool, PoolInitializer, UnboundTokenSeller } from '../generated/templates';

import { UnboundTokenSeller as SellerContract } from '../generated/templates/UnboundTokenSeller/UnboundTokenSeller';
import { IPool as IPoolContract } from '../generated/templates/IPool/IPool';
import { PoolInitializer as PoolInitializerContract } from '../generated/templates/PoolInitializer/PoolInitializer';

import {
  NewPoolInitializer,
  PoolInitialized
} from '../generated/MarketCapSqrtController/MarketCapSqrtController';

import { BigInt } from '@graphprotocol/graph-ts';
import { hexToDecimal } from './helpers';

export function handleNewCategory(event: CategoryAdded): void {
  let category = new Category(event.params.categoryID.toHexString());
  category.metadataHash = event.params.metadataHash;
  category.tokens = [];
  category.save();
}

export function handleTokenAdded(event: TokenAdded): void {
  let categoryID = event.params.categoryID.toHexString();
  let tokenAddress = event.params.token.toHexString();
  let category = Category.load(categoryID);
  let token = Token.load(tokenAddress);
  if (token == null) {
    token = new Token(tokenAddress);
    token.save();
  }
  if (category.tokens == null) category.tokens = [];
  category.tokens.push(tokenAddress);
  category.save();
}

export function handleCategorySorted(event: CategorySorted): void {
  let category = Category.load(event.params.categoryID.toHexString());
  let oracle = MarketCapSqrtController.bind(event.address);
  let tokens = oracle.getCategoryTokens(event.params.categoryID);
  let arr: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    arr.push(tokens[i].toHexString());
  }
  category.tokens = arr;
  category.save();
}

export function handleNewPool(event: NewPoolInitializer): void {
  let categoryID = event.params.categoryID.toHexString();
  let poolAddress = event.params.pool;
  let initializerAddress = event.params.initializer;

  // Start tracking the new pool contract and its initializer
  IPool.create(poolAddress);
  PoolInitializer.create(initializerAddress);

  
  let initializerContract = PoolInitializerContract.bind(initializerAddress);

  // Create the PoolInitializer entity
  let initializer = new Initializer(initializerAddress.toHexString());
  initializer.pool = poolAddress.toHexString();
  initializer.totalCreditedWETH = new BigInt(0);
  let desiredTokens = initializerContract.getDesiredTokens();
  let desiredAmounts = initializerContract.getDesiredAmounts(desiredTokens);
  for (let i = 0; i < desiredTokens.length; i++) {
    let tokenAddress = desiredTokens[i];
    let tokenID = initializerAddress
      .toHexString()
      .concat('-')
      .concat(tokenAddress.toHexString());
    let token = new InitializerToken(tokenID);
    token.poolInitializer = initializerAddress.toHexString();
    token.token = tokenAddress.toHexString();
    token.balance = new BigInt(0);
    token.amountRemaining = desiredAmounts[i];
    token.save();
  }
  initializer.save();

  // Create the IndexPool entity.
  let pool = new IndexPool(poolAddress.toHexString());
  pool.category = categoryID;
  pool.size = event.params.indexSize.toI32();
  pool.totalWeight = new BigInt(0);
  pool.totalSupply = new BigInt(0);
  pool.maxTotalSupply = new BigInt(0);
  pool.feesTotal = new BigInt(0);
  pool.isPublic = false;
  pool.initialized = false;
  pool.save();
}

export function handlePoolInitialized(event: PoolInitialized): void {
  let poolAddress = event.params.pool;
  let sellerAddress = event.params.unboundTokenSeller;

  // Start tracking the token seller contract
  UnboundTokenSeller.create(sellerAddress);

  // Create the TokenSeller entity
  let iseller = SellerContract.bind(sellerAddress);
  let seller = new TokenSeller(sellerAddress.toHexString());
  seller.pool = poolAddress.toHexString();
  seller.premium = iseller.getPremiumPercent();
  seller.save();

  // Update the pool contract
  let ipool = IPoolContract.bind(poolAddress);
  let pool = IndexPool.load(poolAddress.toHexString());
  pool.isPublic = true;
  pool.initialized = true;
  pool.totalWeight = ipool.getTotalDenormalizedWeight();
  pool.totalSupply = ipool.totalSupply();
  pool.maxTotalSupply = ipool.getMaxPoolTokens();
  let swapFee = ipool.getSwapFee();
  pool.swapFee = hexToDecimal(swapFee.toHexString(), 18);
  // Set up the pool tokens
  let tokens = ipool.getCurrentTokens();
  for (let i = 0; i < tokens.length; i++) {
    let tokenAddress = tokens[i];
    let record = ipool.getTokenRecord(tokenAddress);
    let tokenID = poolAddress
      .toHexString()
      .concat('-')
      .concat(tokenAddress.toHexString());
    let token = new PoolUnderlyingToken(tokenID);
    token.token = tokenAddress.toHexString();
    token.denorm = record.denorm;
    token.ready = true;
    token.desiredDenorm = record.desiredDenorm;
    token.balance = record.balance;
    token.pool = poolAddress.toHexString();
    token.save();
  }
  pool.save();
}