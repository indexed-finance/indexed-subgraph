import { BigDecimal, Address, log } from '@graphprotocol/graph-ts'
import { getPairAddress, sortTokens } from './uniswap'
import { convertTokenToDecimal, convertEthToDecimal } from './general'
import { Pair as PairContract } from '../../generated/templates/Pair/Pair'
import { Token } from '../../generated/schema';

/*
// MAINNET token addresses
const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const USDC_WETH_PAIR = '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc' // created 10008355
const DAI_WETH_PAIR = '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11' // created block 10042267
const USDT_WETH_PAIR = '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852' // created block 10093341

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
  '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
  '0x0000000000085d4780b73119b644ae5ecd22b376', // TUSD
  '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643', // cDAI
  '0x39aa39c021dfbae8fac545936693ac917d5e7563', // cUSDC
  '0x86fadb80d8d2cff3c3680819e4da99c10232ba0f', // EBASE
  '0x57ab1ec28d129707052df4df418d58a2d46d5f51', // sUSD
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', // MKR
  '0xc00e94cb662c3520282e6f5717214004a7f26888', // COMP
  '0x514910771af9ca656af840dff83e8264ecf986ca', //LINK
  '0x960b236a07cf122663c4303350609a66a7b288c0', //ANT
  '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f', //SNX
  '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e', //YFI
  '0xdf5e0e81dff6faf3a7e52ba697820c5e32d806a8' // yCurv
] */

const WETH_ADDRESS = '0x72710b0b93c8f86aef4ec8bd832868a15df50375';
const DAI_ADDRESS = '0xea88bdf6917e7e001cb9450e8df08164d75c965e';

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
  log.warning('Getting token prices, token: {}, sorted_0: {}', [token.toHexString(), sorted[0].toHexString()])
  log.warning('Getting token prices, sorted_1: {}', [sorted[1].toHexString()])
  if (sorted[0].toHexString() == token.toHexString()) {
    log.warning('Got token == 0', [])
    ret.push(convertTokenToDecimal(reserves.value0, tokenDecimals))
    ret.push(convertTokenToDecimal(reserves.value1, quoteTokenDecimals))
  } else {
    log.warning('Got token == 1', [])
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