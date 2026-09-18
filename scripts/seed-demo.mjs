import { readFileSync } from 'node:fs';
import { demoId as id, row, runSeed, isMain } from './demo-seed-support.mjs';
const savedTemplate = JSON.parse(readFileSync(new URL('../db/seeds/current-email-template.json', import.meta.url), 'utf8'));
export function buildDemoPlan(env = {}) {
  if (env.DEMO_SUBSCRIPTIONS_CONFIRMED && !['true', 'false'].includes(env.DEMO_SUBSCRIPTIONS_CONFIRMED)) throw Error('DEMO_SUBSCRIPTIONS_CONFIRMED must be true or false');
  const subscribed = env.DEMO_SUBSCRIPTIONS_CONFIRMED === 'true';
  const rows = [row('public.newsletters','id',{id:id(301),title:'[DEMO] Two-family school newsletter',description:'Synthetic demo v1. Family A: shared + Grade 1A + Grade 1B. Family B: shared + Grade 2A.',week_number:null,release_date:new Date().toISOString().slice(0,10),status:'draft'})];
  ['Shared school news','Grade 1A garden story','Grade 1B music story','Grade 2A nature story'].forEach((title,i)=>{
    const classIds = i ? [id(200+i)] : [];
    rows.push(row('public.articles','id',{id:id(401+i),short_id:`demo${i}`,title:`[DEMO] ${title}`,content:`<h2>${title}</h2><p>Synthetic demonstration content. Marker: DEMO-${i ? ['','1A','1B','2A'][i] : 'SHARED'}-ONLY.</p>`,status:'draft',author:'SMZ Demo',visibility_type:i?'class_restricted':'public',restricted_to_classes:i?JSON.stringify(classIds):null,class_ids:classIds}));
    rows.push(row('public.newsletter_articles','id',{id:id(411+i),newsletter_id:id(301),article_id:id(401+i),article_order:i+1,targeting_mode:i?'targeted':'shared',target_class_ids:classIds}));
  });
  rows.push(row('public.email_templates','id',{id:id(501),name:`[DEMO] ${savedTemplate.name}`,description:savedTemplate.description,state:'draft'}));
  rows.push(row('public.email_template_revisions','id',{id:id(502),template_id:id(501),revision_number:1,subject_template:savedTemplate.subject_template,body_template:savedTemplate.body_template,blocks:JSON.stringify(savedTemplate.blocks)}));
  // Link the revision only after both sides of the circular relationship exist.
  rows[rows.length-2].deferred={current_revision_id:id(502)};
  for(let i=0;i<2;i++) rows.push(row('public.newsletter_family_preferences','family_id',{family_id:id(101+i),auth_family_id:id(101+i),newsletter_subscription_status:subscribed?'subscribed':'pending',newsletter_subscription_source:subscribed?'operator_demo_opt_in':'demo_seed_pending',newsletter_subscription_updated_at:new Date().toISOString(),newsletter_subscribed_at:subscribed?new Date().toISOString():null}));
  return rows;
}
if(isMain(import.meta.url)) runSeed(buildDemoPlan,['.env.local','.env']).catch(error=>{console.error(error.message);process.exitCode=1;});
