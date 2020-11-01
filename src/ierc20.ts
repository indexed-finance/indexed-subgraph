import { Address } from "@graphprotocol/graph-ts";
import { IERC20 } from "../generated/templates/IPool/IERC20";

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