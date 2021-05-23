import { BigDecimal, Address, log } from '@graphprotocol/graph-ts'
import { getPairAddress, sortTokens } from './uniswap'
import { convertTokenToDecimal, ONE_BD } from './general'
import { Pair as PairContract } from '../../generated/templates/IPool/Pair'
import { Token } from '../../generated/schema';

// Mainnet
const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';

// Rinkeby
// const WETH_ADDRESS = '0x72710b0b93c8f86aef4ec8bd832868a15df50375';
// const DAI_ADDRESS = '0xea88bdf6917e7e001cb9450e8df08164d75c965e';

// Returns the reserves for the pair between token<->quoteToken as [tokenReserves, quoteTokenReserves]
export function getPairReserves(
  token: Address,
  tokenDecimals: i32,
  quoteToken: Address,
  quoteTokenDecimals: i32
): BigDecimal[] {
  let sorted = sortTokens(token, quoteToken);
  let pairAddress = getPairAddress(token, quoteToken)
  let pair = PairContract.bind(pairAddress)
  let reserves = pair.getReserves()
  let ret = new Array<BigDecimal>()
  if (sorted[0].toHexString() == token.toHexString()) {
    ret.push(convertTokenToDecimal(reserves.value0, tokenDecimals))
    ret.push(convertTokenToDecimal(reserves.value1, quoteTokenDecimals))
  } else {
    ret.push(convertTokenToDecimal(reserves.value1, tokenDecimals))
    ret.push(convertTokenToDecimal(reserves.value0, quoteTokenDecimals))

  }
  return ret;
}

// Returns the price of `token` in terms of `quoteToken`
export function getTokenPrice(
  token: Address,
  tokenDecimals: i32,
  quoteToken: Address,
  quoteTokenDecimals: i32
): BigDecimal {
  if (
    token.equals(Address.fromString(WETH_ADDRESS)) &&
    quoteToken.equals(Address.fromString(WETH_ADDRESS))
  ) {
    return ONE_BD;
  }
  let reserves = getPairReserves(token, tokenDecimals, quoteToken, quoteTokenDecimals);
  // Price of token is quoteReserves / tokenReserves
  return reserves[1].div(reserves[0]);
}

// Returns the price of ether in terms of DAI
export function getEthPriceUsd(): BigDecimal {
  return getTokenPrice(
    Address.fromString(WETH_ADDRESS),
    18,
    Address.fromString(DAI_ADDRESS),
    18
  );
}

// Returns the price of DAI in terms of ether
export function getUsdPriceEth(): BigDecimal {
  return getTokenPrice(
    Address.fromString(DAI_ADDRESS),
    18,
    Address.fromString(WETH_ADDRESS),
    18
  );
}

// Address, tokenDecimals: BigInt
export function getTokenPriceUSD(token: Token): BigDecimal {
  // Get the price of the token in terms of eth
  let tokenPriceEth = getTokenPrice(
    Address.fromString(token.id),
    token.decimals,
    Address.fromString(WETH_ADDRESS),
    18
  );
  let ethPriceUsd = getEthPriceUsd();
  return tokenPriceEth.times(ethPriceUsd);
}
