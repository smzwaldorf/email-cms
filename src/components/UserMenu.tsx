/**
 * User Menu Component
 * Displays logged-in user info and logout button
 * Positioned in the header/navigation area
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export const UserMenu: React.FC = () => {
  const navigate = useNavigate()
  const { user, signOut, isLoading } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  if (!user) {
    return null
  }

  const handleSignOut = async () => {
    await signOut()
    setIsOpen(false)
    navigate('/login')
  }

  return (
    <div className="relative">
      {/* Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="User menu"
      >
        {/* User Avatar */}
        <div className="w-8 h-8 rounded-full bg-waldorf-peach flex items-center justify-center text-white font-bold text-sm">
          {user.email.charAt(0).toUpperCase()}
        </div>

        {/* User Email */}
        <span className="text-sm font-medium text-gray-700 hidden sm:block">{user.email}</span>

        {/* Dropdown Arrow */}
        <svg
          className={`w-4 h-4 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-sm font-medium text-gray-900">{user.email}</p>
            <p className="text-xs text-gray-500 capitalize">{user.role}</p>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              disabled={isLoading}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}

      {/* Backdrop to close menu */}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  )
}
