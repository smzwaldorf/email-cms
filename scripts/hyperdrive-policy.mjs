/** A connector budget is shared by all Workers using that connector. */
export function verifyHyperdrivePolicy(config, expectedDatabase) {
  if (config?.caching?.disabled !== true) throw new Error('Hyperdrive query caching must be disabled')
  if (config?.origin?.database !== expectedDatabase) throw new Error(`Hyperdrive must target ${expectedDatabase}`)
  if (config.origin_connection_limit !== 5) throw new Error('CMS Hyperdrive origin connection limit must be 5 to preserve shared database capacity')
}
