
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// Load env vars
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testUpload() {
  console.log('1. Signing in...')
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'parent1@example.com',
    password: 'parent1password123',
  })

  if (authError) {
    console.error('Sign in failed:', authError)
    return
  }

  console.log('Sign in successful:', authData.user?.id)

  console.log('2. Uploading file...')
  const fileName = `test-${Date.now()}.txt`
  const fileContent = 'Hello Supabase Storage'
  const file = new Blob([fileContent], { type: 'text/plain' })

  const { data, error } = await supabase.storage
    .from('media')
    .upload(`${authData.user?.id}/${fileName}`, file)

  if (error) {
    console.error('Upload failed:', error)
    return
  }
  
  console.log('Upload successful:', data)

  console.log('3. Inserting into media_files...')
  const mediaId = crypto.randomUUID()
  const { data: dbData, error: dbError } = await supabase
    .from('media_files')
    .insert({
      id: mediaId,
      filename: fileName,
      file_size: file.size,
      mime_type: file.type,
      file_type: 'document', // Test the new enum value
      public_url: `storage://media/${data.path}`,
      storage_path: data.path,
      uploaded_by: authData.user?.id
    })
    .select()
    .single()

  if (dbError) {
    console.error('DB Insert failed:', dbError)
  } else {
    console.log('DB Insert successful:', dbData)
  }
}

testUpload()
