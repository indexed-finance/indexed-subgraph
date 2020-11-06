import {
  BigInt,
  BigDecimal,
  Bytes,
  Address
} from '@graphprotocol/graph-ts';
import { IERC20 } from "../generated/templates/IPool/IERC20";

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

export function getDecimals(ierc20: IERC20): i32 {
  let _decimals = ierc20.try_decimals();
  if (_decimals.reverted) {
    return 18 as i32;
  } else {
    return _decimals.value;
  }
}

export function getName(ierc20: IERC20): string | null {
  let _name = ierc20.try_name();
  if (_name.reverted) {
    return null;
  } else {
    return _name.value;
  }
}

export function getSymbol(ierc20: IERC20): string | null {
  let _symbol = ierc20.try_symbol();
  if (_symbol.reverted) {
    return null;
  } else {
    return _symbol.value;
  }
}