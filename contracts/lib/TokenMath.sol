pragma solidity ^0.6.0;

import "../interfaces/IERC20.sol";
import "./FixedPoint.sol";

library TokenMath {
  using FixedPoint for FixedPoint.uq112x112;
  using FixedPoint for FixedPoint.uq144x112;

  uint32 internal constant MAX_32_BIT = uint32(2**32 - 1);

  /**
   * @dev Query the decimals for a token.
   * If the token does not support the `decimals()` function, this will return
   * 18 by default.
   */
  function getDecimals(address token) internal view returns (uint8) {
    try IERC20(token).decimals() returns (uint8 decimals) {
      return decimals;
    } catch {
      return 18;
    }
  }

  /**
   * @dev Returns the amount of base units needed to represent `amount`
   * full tokens by multiplying `amount` by 10^`decimals`
   */
  function tokenAmount(uint256 decimals, uint256 amount)
  internal pure returns (uint256) {
    return amount * 10**decimals;
  }

  /**
   * @dev Crunches the price of a token into 32 bits by multiplying it by
   * 100k full tokens and dividing by 1 full stablecoin it is priced in.
   * Multiplies the price (represented as a fraction) by 100,000,000
   * of the token (expressed in full units, i.e. multipled by 10^decimals),
   * then divides the result by the decimals for the token it is priced with.
   * Note: This assumes that the value of `tokenA` is less than 42,949 (2**32/1e5)
   * `tokenB` and greater than 1e-5 `tokenB`. If this is false, this function will
   * return either 0 or 2**32 - 1
   * @param tokenA Token which is priced
   * @param tokenB Token used to price `tokenA`
   * @param price Price of `tokenA` in `tokenB`
   */
  function crunchPrice100k_32bit(
    address tokenA,
    address tokenB,
    FixedPoint.uq112x112 memory price
  ) internal view returns (uint32) {
    // 100,000 token A
    uint256 a100k = tokenAmount(
      getDecimals(tokenA),
      100000
    );
    // 1 token B
    uint256 b1 = tokenAmount(
      getDecimals(tokenB),
      1
    );
    // Multiply the price by 100k full a tokens, then divide by 1 b token.
    uint256 price100k = price.mul(a100k).decode144() / b1;
    if (price100k > MAX_32_BIT) return MAX_32_BIT;
    return uint32(price100k);
  }
}