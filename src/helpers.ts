import {
  BigInt,
  BigDecimal,
  Bytes,
  Address
} from '@graphprotocol/graph-ts';

export function hexToDecimal(hexString: string, decimals: number): BigDecimal {
  let bytes = Bytes.fromHexString(hexString).reverse() as Bytes;
  let bi = BigInt.fromUnsignedBytes(bytes);
  let scale = BigInt.fromI32(10).pow(decimals as u8).toBigDecimal();
  return bi.divDecimal(scale)
}

export function joinHyphen(vals: string[]): string {
  let ret = '';
  for (let i = 0; i < vals.length; i++) {
    ret = ret.concat('-').concat(vals[i]);
  }
  return ret;
}