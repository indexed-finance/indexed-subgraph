import { BigInt, BigDecimal, Bytes, } from '@graphprotocol/graph-ts';

export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let BI_18 = BigInt.fromI32(18)

export function hexToDecimal(hexString: string, decimals: number): BigDecimal {
  let bytes = Bytes.fromHexString(hexString).reverse() as Bytes;
  let bi = BigInt.fromUnsignedBytes(bytes);
  let scale = BigInt.fromI32(10).pow(decimals as u8).toBigDecimal();
  return bi.divDecimal(scale)
}

export function joinHyphen(vals: string[]): string {
  let ret = vals[0];
  for (let i = 1; i < vals.length; i++) {
    ret = ret.concat('-').concat(vals[i]);
  }
  return ret;
}

export function convertTokenToDecimal(amount: BigInt, decimals: i32): BigDecimal {
  let scale = BigInt.fromI32(10).pow(decimals as u8).toBigDecimal()
  return amount.toBigDecimal().div(scale)
}

export function convertEthToDecimal(eth: BigInt): BigDecimal {
  return convertTokenToDecimal(eth, 18)
}

export function equalToZero(value: BigDecimal): boolean {
  const formattedVal = parseFloat(value.toString())
  const zero = parseFloat(ZERO_BD.toString())
  if (zero == formattedVal) {
    return true
  }
  return false
}

export function isNullEthValue(value: string): boolean {
  return value == '0x0000000000000000000000000000000000000000000000000000000000000001' || value == ''
}