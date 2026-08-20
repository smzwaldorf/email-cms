/**
 * Test Article Save
 * Verifies that RLS policies allow admins to update articles
 * Usage: npx ts-node scripts/test-article-save.ts
 */

import { createClient } from './lib/dbClient.ts'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local')
  process.exit(1)
}

async function testArticleSave() {
  console.log('📝 Testing Article Save (UPDATE via RLS)\n')

  const admin = {
    email: 'admin@example.com',
    password: 'admin123456',
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Sign in as admin
    console.log(`🔐 Signing in as ${admin.email}...`)
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: admin.email,
      password: admin.password,
    })

    if (signInError) {
      console.error(`❌ Sign in failed: ${signInError.message}`)
      process.exit(1)
    }

    console.log(`✅ Sign in successful\n`)

    // Fetch first article for week 2025-W47
    console.log('📖 Fetching first article from week 2025-W47...')
    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, content, week_number')
      .eq('week_number', '2025-W47')
      .order('article_order')
      .limit(1)

    if (fetchError) {
      console.error(`❌ Failed to fetch articles: ${fetchError.message}`)
      process.exit(1)
    }

    if (!articles || articles.length === 0) {
      console.error('❌ No articles found in week 2025-W47')
      process.exit(1)
    }

    const article = articles[0]
    console.log(`✅ Fetched article: "${article.title}" (ID: ${article.id})\n`)

    // Attempt to update the article
    const originalTitle = article.title
    const newTitle = `${originalTitle} - Updated at ${new Date().toISOString()}`

    console.log(`📝 Attempting to update article title...`)
    console.log(`   Original: "${originalTitle}"`)
    console.log(`   New:      "${newTitle}"\n`)

    const { data: updatedArticle, error: updateError } = await supabase
      .from('articles')
      .update({
        title: newTitle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', article.id)
      .select()
      .single()

    if (updateError) {
      console.error(`❌ Article update failed: ${updateError.message}`)
      console.error(`   Code: ${updateError.code}`)
      process.exit(1)
    }

    console.log(`✅ Article updated successfully!`)
    console.log(`   New title: "${updatedArticle.title}"`)
    console.log(`   Updated at: ${updatedArticle.updated_at}\n`)

    // Verify the update persisted
    console.log(`🔍 Verifying update persistence...`)
    const { data: verifyArticle, error: verifyError } = await supabase
      .from('articles')
      .select('id, title')
      .eq('id', article.id)
      .single()

    if (verifyError) {
      console.error(`❌ Verification failed: ${verifyError.message}`)
      process.exit(1)
    }

    if (verifyArticle.title === newTitle) {
      console.log(`✅ Update persisted correctly!\n`)
    } else {
      console.error(`❌ Update not persisted. Title is: "${verifyArticle.title}"\n`)
      process.exit(1)
    }

    // Sign out
    await supabase.auth.signOut()
    console.log('✅ Article save test PASSED!')
  } catch (err) {
    console.error(`❌ Unexpected error: ${(err as any).message}`)
    process.exit(1)
  }
}

testArticleSave()
