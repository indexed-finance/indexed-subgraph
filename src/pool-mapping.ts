import { LOG_DENORM_UPDATED, LOG_DESIRED_DENORM_SET } from "../generated/templates/BPool/BPool";
import { PoolToken } from "../generated/schema";

export function handleDenormUpdated(event: LOG_DENORM_UPDATED): void {
  let poolID = event.address.toHex();
  let tokenAddress = event.params.token.toHex();
  let tokenID = poolID + '-' + tokenAddress;
  let token = PoolToken.load(tokenID);
  token.denorm = event.params.newDenorm;
  token.save();
}

export function handleDesiredDenormSet(event: LOG_DESIRED_DENORM_SET): void {
  let poolID = event.address.toHex();
  let tokenAddress = event.params.token.toHex();
  let tokenID = poolID + '-' + tokenAddress;
  let token = PoolToken.load(tokenID);
  token.desiredDenorm = event.params.desiredDenorm;
  token.save();
}