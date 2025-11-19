/**
 * Test Article Visibility
 * Verifies that RLS policies correctly restrict article visibility
 * Usage: npx ts-node scripts/test-article-visibility.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local')
  process.exit(1)
}

const testAccounts = [
  {
    email: 'parent1@example.com',
    password: 'parent1password123',
    expectedArticles: 4, // 2 public + 2 class-restricted (A1, B1)
  },
  {
    email: 'parent2@example.com',
    password: 'parent2password123',
    expectedArticles: 3, // 2 public + 1 class-restricted (A2)
  },
]

async function testArticleVisibility() {
  console.log('📰 Testing Article Visibility (RLS)\n')

  for (const account of testAccounts) {
    console.log(`🔐 Testing: ${account.email}`)
    const supabase = createClient(supabaseUrl, supabaseKey)

    try {
      // Sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      })

      if (signInError) {
        console.error(`  ❌ Sign in failed: ${signInError.message}`)
        continue
      }

      // Fetch visible articles
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('id, title, visibility_type, restricted_to_classes')
        .eq('week_number', '2025-W47')
        .order('article_order')

      if (articlesError) {
        console.error(`  ❌ Failed to fetch articles: ${articlesError.message}`)
        continue
      }

      console.log(`  ✅ Found ${articles?.length || 0} articles (expected: ${account.expectedArticles})`)

      if (articles) {
        articles.forEach((article, index) => {
          console.log(
            `     ${index + 1}. "${article.title}" (${article.visibility_type}${article.restricted_to_classes ? ` - ${(article.restricted_to_classes as string[]).join(', ')}` : ''})`,
          )
        })
      }

      // Verify count
      if (articles?.length === account.expectedArticles) {
        console.log(`  ✅ Article count matches expected!\n`)
      } else {
        console.log(
          `  ⚠️  Article count mismatch! Got ${articles?.length}, expected ${account.expectedArticles}\n`,
        )
      }

      // Sign out
      await supabase.auth.signOut()
    } catch (err) {
      console.error(`  ❌ Error: ${(err as any).message}\n`)
    }
  }

  console.log('✅ Article visibility test complete!')
}

testArticleVisibility()
