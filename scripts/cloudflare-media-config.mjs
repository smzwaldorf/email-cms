import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function mediaWorkerConfiguration(env) {
  const environment = env.CMS_DEPLOY_ENVIRONMENT
  if (!['staging','production'].includes(environment)) throw new Error('Select staging or production')
  for (const key of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_HYPERDRIVE_ID']) if (!/^[a-f0-9]{32}$/.test(env[key] ?? '') || /^0+$/.test(env[key])) throw new Error(`Missing or invalid ${key}`)
  const root = fileURLToPath(new URL('../',import.meta.url))
  const bucket = environment === 'production' ? 'smz-cms-media-production' : 'smz-cms-media-dev-staging'
  return { name:`${environment}-smz-news-media`, main:path.join(root,'apps/backend/src/cloudflare/mediaWorker.ts'), account_id:env.CLOUDFLARE_ACCOUNT_ID,
    compatibility_date:'2026-09-12', compatibility_flags:['nodejs_compat'], workers_dev:false, preview_urls:false,
    routes:[{pattern:environment === 'production' ? 'media.smzwaldorf.com' : 'staging-media.smzwaldorf.com',custom_domain:true}],
    alias:{'@email-cms/shared':path.join(root,'packages/shared/src/index.ts')},
    r2_buckets:[{binding:'MEDIA_BUCKET',bucket_name:bucket}], hyperdrive:[{binding:'HYPERDRIVE',id:env.CLOUDFLARE_HYPERDRIVE_ID}],
    vars:{MEDIA_R2_BUCKET:bucket,MEDIA_STORAGE_ENVIRONMENT:environment}, observability:{enabled:true} }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = mediaWorkerConfiguration(process.env)
  const directory = new URL('../.wrangler/media/',import.meta.url)
  await mkdir(directory,{recursive:true})
  await writeFile(new URL(`${config.vars.MEDIA_STORAGE_ENVIRONMENT}.json`,directory),JSON.stringify(config,null,2)+'\n')
  console.info(`Generated .wrangler/media/${config.vars.MEDIA_STORAGE_ENVIRONMENT}.json`)
}
