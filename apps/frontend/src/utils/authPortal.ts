/** Use the same Auth origin as CMS sign-in in every environment. */
export function familyProfileUrl(): string {
  return new URL('/profiles/family', import.meta.env.VITE_SMZ_AUTH_ISSUER || 'http://localhost:3000/api/auth').toString()
}
