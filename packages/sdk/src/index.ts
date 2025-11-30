export type { BeaconConfig, EventProps, ConnectionState } from "./beacon";
export {
  init,
  track,
  identify,
  page,
  getConnectionState,
  disconnect,
} from "./beacon";
export { isEnabled as flag } from "./flags";
