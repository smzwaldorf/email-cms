/**
 * Retired: importing duplicated people, families, classes, and memberships is
 * prohibited. Run the reviewed identity-retirement migration only against a
 * disposable restored copy after the Auth delivery-contact API cutover.
 */
console.error('rehearse-data-migration is retired: Auth owns the directory; CMS must not import identity masters.')
process.exitCode = 1
