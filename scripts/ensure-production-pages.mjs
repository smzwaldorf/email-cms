const {CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token,DEPLOYMENT_ENVIRONMENT:environment}=process.env
if(environment!=='production'||!account||!token) throw new Error('Production credentials required')
const url=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects`
const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'}
const name='production-smz-news'
const response=await fetch(`${url}/${name}`,{headers})
if(response.status===404){
 const created=await fetch(url,{method:'POST',headers,body:JSON.stringify({name,production_branch:'main'})})
 const body=await created.json()
 if(!created.ok||!body.success)throw new Error(`Pages creation failed: ${created.status}`)
}else if(!response.ok)throw new Error(`Pages lookup failed: ${response.status}`)
console.info('Production News Pages project exists')
