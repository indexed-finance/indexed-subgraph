import { log, BigInt, Address, Bytes } from '@graphprotocol/graph-ts'
import { IERC20 } from '../../generated/templates/Pair/IERC20'
import { Factory as FactoryContract } from '../../generated/templates/Pair/Factory'
import { 
  fetchTokenSymbolFromTokenList,
  fetchTokenNameFromTokenList,
  fetchTokenDecimalsFromTokenList,
} from './tokenList'
import { isNullEthValue } from './general';

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
export const FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'

export let factoryContract = FactoryContract.bind(Address.fromString(FACTORY_ADDRESS))

export function sortTokens(tokenA: Address, tokenB: Address): Address[] {
  let ret = new Array<Address>()
  let a = BigInt.fromUnsignedBytes(Bytes.fromHexString(tokenA.toHexString()).reverse() as Bytes)
  let b = BigInt.fromUnsignedBytes(Bytes.fromHexString(tokenB.toHexString()).reverse() as Bytes)
  if (a.lt(b)) {
    ret.push(tokenA)
    ret.push(tokenB)
  } else {
    ret.push(tokenB)
    ret.push(tokenA)
  }
  return ret
}

export function getPairAddress(tokenA: Address, tokenB: Address): Address {
  let sorted = sortTokens(tokenA, tokenB)
  let pairAddress = factoryContract.getPair(sorted[0], sorted[1])
  
  // Not handled because all tokens in current subgraph necessarily have an eth pair
  // if (pairAddress.toHexString() == ADDRESS_ZERO) {
  //   return null
  // }
  return pairAddress
}

export function fetchTokenSymbol(tokenAddress: Address): string {
  let contract = IERC20.bind(tokenAddress)
  let contractSymbolBytes = IERC20.bind(tokenAddress)

  // try types string and bytes32 for symbol
  let symbolValue = 'unknown'
  let symbolResult = contract.try_symbol()
  if (symbolResult.reverted) {
    let symbolResultBytes = contractSymbolBytes.try_symbol()
    if (!symbolResultBytes.reverted) {
      // for broken pairs that have no symbol function exposed
      if (!isNullEthValue(symbolResultBytes.value)) {
        symbolValue = symbolResultBytes.value.toString()
      }
    } else {
      // Fallback to token list
      log.warning('Token symbol not defined in IERC20 Contract: {}', [tokenAddress.toHexString()])
      symbolValue = fetchTokenSymbolFromTokenList(tokenAddress)
    }
  } else {
    symbolValue = symbolResult.value
  }

  return symbolValue
}

export function fetchTokenName(tokenAddress: Address): string {
  let contract = IERC20.bind(tokenAddress)
  let contractNameBytes = IERC20.bind(tokenAddress)

  // try types string and bytes32 for name
  let nameValue = 'unknown'
  let nameResult = contract.try_name()
  if (nameResult.reverted) {
    let nameResultBytes = contractNameBytes.try_name()
    if (!nameResultBytes.reverted) {
      // for broken exchanges that have no name function exposed
      if (!isNullEthValue(nameResultBytes.value)) {
        nameValue = nameResultBytes.value.toString()
      }
    } else {
      // Fallback to token list
      log.warning('Token name not defined in IERC20 Contract: {}',  [tokenAddress.toHexString()])
      nameValue = fetchTokenNameFromTokenList(tokenAddress)
    }
  } else {
    nameValue = nameResult.value
  }

  return nameValue
}

export function fetchTokenDecimals(tokenAddress: Address): i32 {
  // hardcode overrides
  if (tokenAddress.toHexString() == '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9') {
    return 18
  }

  let contract = IERC20.bind(tokenAddress)
  // try types uint8 for decimals
  let decimalValue = null
  let decimalResult = contract.try_decimals()
  if (!decimalResult.reverted) {
    decimalValue = decimalResult.value
  } else {
    log.warning('Token decimals not defined in IERC20 Contract: {}', [tokenAddress.toHexString()])
    return fetchTokenDecimalsFromTokenList(tokenAddress)
  }
  return decimalValue as i32
}