export function databaseName(env) {
  const environment = env.DEPLOYMENT_ENVIRONMENT || 'staging'
  if (!['staging', 'production'].includes(environment)) throw new Error('Invalid DEPLOYMENT_ENVIRONMENT')
  return environment === 'production' ? 'production-news' : 'smz-cms'
}
