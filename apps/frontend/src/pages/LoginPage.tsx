import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { GoogleButton } from '@/components/GoogleButton'
import { isSafeAppRedirectPath } from '@/utils/urlUtils'

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const { isLoading } = useAuth()
  const requestedRedirect = searchParams.get('redirect_to')
  const redirectTo = isSafeAppRedirectPath(requestedRedirect) ? requestedRedirect : undefined

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-waldorf-sage-100 via-waldorf-cream-100 to-waldorf-clay-50 flex items-center justify-center p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_rgba(233,125,67,0.25),transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(135,153,107,0.20),transparent_40%)]" />

      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-waldorf-cream-200 bg-white/85 backdrop-blur-sm shadow-2xl shadow-waldorf-clay-200/40 lg:grid lg:grid-cols-[1.1fr,0.9fr]">
        <section className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-waldorf-clay-700 via-waldorf-clay-800 to-waldorf-clay-900 text-white">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs tracking-wide uppercase">
              <span className="h-2 w-2 rounded-full bg-waldorf-peach-300" />
              安全登入
            </p>
            <h1 className="mt-6 font-display text-4xl leading-tight">電子報閱讀器</h1>
            <p className="mt-3 text-waldorf-cream-100/90">
              提供家長、教師與管理員使用的電子報閱讀平台。
            </p>
          </div>

          <div className="space-y-4 text-sm text-waldorf-cream-100/90">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="font-semibold text-white">一組學校帳號</p>
              <p className="mt-1">使用已核准的學校帳號，透過 SMZ Identity 登入。</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="font-semibold text-white">依學校角色提供存取權限</p>
              <p className="mt-1">學校帳號決定您可以閱讀的電子報及使用的管理工具。</p>
            </div>
          </div>
        </section>

        <section className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-display font-semibold text-waldorf-clay-800 mb-2">歡迎回來</h2>
            <p className="text-waldorf-clay-500">請前往學校身分驗證服務登入。</p>
          </div>

          <GoogleButton disabled={isLoading} redirectTo={redirectTo} />

          <p className="mt-5 rounded-xl border border-waldorf-cream-300 bg-waldorf-cream-50 px-4 py-3 text-sm text-waldorf-clay-600">
            只有已核准、啟用且具備 Email CMS 存取權的學校帳號可以登入。
          </p>
        </section>
      </div>
    </div>
  )
}
