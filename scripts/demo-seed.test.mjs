import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPlan, row } from './demo-seed-support.mjs';
import { buildDemoPlan } from './seed-demo.mjs';
const env={DEMO_PARENT_A_EMAIL:'demo.a@example.invalid',DEMO_PARENT_B_EMAIL:'demo.b@example.invalid'};
test('fixture contains no delivery events, jobs, sessions or verified/demo admin accounts',()=>{
 const rows=buildDemoPlan(env);
 assert(rows.length>0);
 assert(rows.every(r=>!/(delivery|analytics|session|oauth)/.test(r.table)));
 assert(rows.filter(r=>r.table==='auth.user').every(r=>r.values.email_verified===false));
 assert(rows.filter(r=>r.table==='directory.person_roles').every(r=>r.values.role!=='admin'));
 assert(rows.filter(r=>r.table==='public.newsletter_family_preferences').every(r=>r.values.newsletter_subscription_status==='subscribed'));
});
test('explicit demo consent-gate mode seeds pending preferences',()=>{
 const rows=buildDemoPlan({...env,DEMO_SUBSCRIPTIONS_CONFIRMED:'false'});
 assert(rows.filter(r=>r.table==='public.newsletter_family_preferences').every(r=>r.values.newsletter_subscription_status==='pending'));
});
test('fixture routes four illustrated shared articles to the weekly summary',()=>{
 const rows=buildDemoPlan(env);
 assert(rows.some(r=>r.table==='public.article_tags'&&r.values.name==='weekly'&&r.values.is_active===true));
 const weeklyIds=['000000000405','000000000406','000000000407','000000000408'];
 const articles=rows.filter(r=>r.table==='public.articles'&&weeklyIds.some(id=>r.values.id.endsWith(id)));
 assert.equal(articles.length,4);
 assert(articles.every(r=>/<img src="https:\/\/smz-email-assets\.pages\.dev\/smz-school-news\/demo-article-[a-z]+\.jpg"/.test(r.values.content)));
 assert(weeklyIds.every(id=>rows.some(r=>r.table==='public.article_tag_assignments'&&r.values.article_id.endsWith(id)&&r.values.tag_id.endsWith('000000000601'))));
 assert(weeklyIds.every(id=>rows.some(r=>r.table==='public.newsletter_articles'&&r.values.article_id.endsWith(id)&&r.values.targeting_mode==='shared')));
 const revision=rows.find(r=>r.table==='public.email_template_revisions');
 const blocks=JSON.parse(revision.values.blocks);
 assert.equal(blocks.find(block=>block.type==='shared-article-feature').config.excludeSourceTag,'weekly');
 assert.equal(blocks.find(block=>block.type==='weekly-summary-list').config.sourceTag,'weekly');
 assert.match(blocks.find(block=>block.type==='weekly-summary-list').bodyHtml,/article\.image_url/);
});
test('every seeded article includes an email-safe hosted image',()=>{
 const articles=buildDemoPlan(env).filter(r=>r.table==='public.articles');
 assert.equal(articles.length,8);
 assert(articles.every(r=>/<img src="https:\/\/smz-email-assets\.pages\.dev\/smz-school-news\/demo-article-[a-z]+\.jpg"/.test(r.values.content)));
});
test('partial fixture aborts and does not recreate missing rows',async()=>{
 const rows=[row('public.fixture','id',{id:'one'}),row('public.fixture','id',{id:'two'})];let n=0;const log=[];
 const client={query:async(sql)=>{log.push(sql);return {rows:sql.startsWith('SELECT *')&&n++===0?[{id:'one'}]:[]}}};
 await assert.rejects(applyPlan(client,rows,{apply:true}),/Partial/);
 assert(!log.some(sql=>sql.startsWith('INSERT')));assert.equal(log.at(-1),'ROLLBACK');
});
test('rerun never resets edited fields or unsubscribed state',async()=>{
 const rows=[row('public.fixture','id',{id:'one',newsletter_subscription_status:'subscribed'})];const log=[];
 const client={query:async(sql)=>{log.push(sql);return {rows:sql.startsWith('SELECT *')?[{id:'one',newsletter_subscription_status:'unsubscribed'}]:[]}}};
 assert.deepEqual(await applyPlan(client,rows,{apply:true}),{state:'already-present',inserted:0});
 assert(!log.some(sql=>/^(INSERT|UPDATE)/.test(sql)));
});
test('email identity conflicts fail closed',async()=>{
 const client={query:async(sql)=>({rows:sql.startsWith('SELECT *')?[{id:'one',email:'existing@example.invalid'}]:[]})};
 await assert.rejects(applyPlan(client,[row('auth.user','id',{id:'one',email:'different@example.invalid'})],{apply:true}),/conflict/);
});
test('check mode uses rollback, apply uses commit, errors roll back',async()=>{
 for(const apply of [false,true]){
  const log=[];const client={query:async(sql)=>{log.push(sql);return {rows:[]}}};
  await applyPlan(client,[row('public.fixture','id',{id:'one'})],{apply});assert.equal(log.at(-1),apply?'COMMIT':'ROLLBACK');
 }
 const log=[];const client={query:async(sql)=>{log.push(sql);if(sql.startsWith('INSERT'))throw Error('collision');return {rows:[]}}};
 await assert.rejects(applyPlan(client,[row('public.fixture','id',{id:'one'})],{apply:true}),/collision/);assert.equal(log.at(-1),'ROLLBACK');
});
