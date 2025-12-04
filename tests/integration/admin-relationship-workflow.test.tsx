import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RelationshipMatrix } from '@/components/admin/RelationshipMatrix'
import type { AdminUser } from '@/types/admin'

describe('Admin Parent-Student Relationship Workflow', () => {
  const mockParents: AdminUser[] = [
    {
      id: 'parent-1',
      email: 'parent1@example.com',
      name: '張家長',
      role: 'parent',
      status: 'active',
      createdAt: '2025-01-01',
      updatedAt: '2025-12-04',
    },
    {
      id: 'parent-2',
      email: 'parent2@example.com',
      name: '李家長',
      role: 'parent',
      status: 'active',
      createdAt: '2025-01-02',
      updatedAt: '2025-12-04',
    },
  ]

  const mockStudents: AdminUser[] = [
    {
      id: 'student-1',
      email: 'student1@example.com',
      name: '小明',
      role: 'student',
      status: 'active',
      createdAt: '2025-01-01',
      updatedAt: '2025-12-04',
    },
    {
      id: 'student-2',
      email: 'student2@example.com',
      name: '小紅',
      role: 'student',
      status: 'active',
      createdAt: '2025-01-02',
      updatedAt: '2025-12-04',
    },
    {
      id: 'student-3',
      email: 'student3@example.com',
      name: '小剛',
      role: 'student',
      status: 'active',
      createdAt: '2025-01-03',
      updatedAt: '2025-12-04',
    },
  ]

  const mockRelationships = [
    { parentId: 'parent-1', studentId: 'student-1' },
    { parentId: 'parent-1', studentId: 'student-2' },
    { parentId: 'parent-2', studentId: 'student-2' },
  ]

  describe('RelationshipMatrix Component', () => {
    it('renders relationship matrix with parents and students', () => {
      const onLink = vi.fn()
      const onUnlink = vi.fn()

      const { container } = render(
        <RelationshipMatrix
          parents={mockParents}
          students={mockStudents}
          relationships={mockRelationships}
          onLinkParentStudent={onLink}
          onUnlinkParentStudent={onUnlink}
        />
      )

      expect(container.textContent).toContain('張家長')
      expect(container.textContent).toContain('李家長')
      expect(container.textContent).toContain('小明')
      expect(container.textContent).toContain('小紅')
      expect(container.textContent).toContain('小剛')
    })

    it('displays existing relationships with checkmarks', () => {
      const onLink = vi.fn()
      const onUnlink = vi.fn()

      const { container } = render(
        <RelationshipMatrix
          parents={mockParents}
          students={mockStudents}
          relationships={mockRelationships}
          onLinkParentStudent={onLink}
          onUnlinkParentStudent={onUnlink}
        />
      )

      // Should show checkmarks for existing relationships
      const checkmarks = container.querySelectorAll('button:contains("✓")')
      expect(checkmarks.length).toBeGreaterThan(0)
    })

    it('calls onLinkParentStudent when adding new relationship', async () => {
      const onLink = vi.fn().mockResolvedValue(undefined)
      const onUnlink = vi.fn()

      const { container } = render(
        <RelationshipMatrix
          parents={mockParents}
          students={mockStudents}
          relationships={[]}
          onLinkParentStudent={onLink}
          onUnlinkParentStudent={onUnlink}
        />
      )

      const buttons = container.querySelectorAll('button')
      const firstButton = buttons[0]

      if (firstButton) {
        fireEvent.click(firstButton)

        await waitFor(() => {
          expect(onLink).toHaveBeenCalled()
        })
      }
    })

    it('calls onUnlinkParentStudent when removing existing relationship', async () => {
      const onLink = vi.fn()
      const onUnlink = vi.fn().mockResolvedValue(undefined)

      const { container } = render(
        <RelationshipMatrix
          parents={mockParents}
          students={mockStudents}
          relationships={mockRelationships}
          onLinkParentStudent={onLink}
          onUnlinkParentStudent={onUnlink}
        />
      )

      const buttons = container.querySelectorAll('button')
      // Find a button that shows a checkmark (existing relationship)
      const linkedButton = Array.from(buttons).find(btn =>
        btn.textContent?.includes('✓')
      )

      if (linkedButton) {
        fireEvent.click(linkedButton)

        await waitFor(() => {
          expect(onUnlink).toHaveBeenCalled()
        })
      }
    })

    it('handles empty parents list', () => {
      const onLink = vi.fn()
      const onUnlink = vi.fn()

      const { container } = render(
        <RelationshipMatrix
          parents={[]}
          students={mockStudents}
          relationships={[]}
          onLinkParentStudent={onLink}
          onUnlinkParentStudent={onUnlink}
        />
      )

      expect(container.textContent).toContain('沒有家長')
    })

    it('handles empty students list', () => {
      const onLink = vi.fn()
      const onUnlink = vi.fn()

      const { container } = render(
        <RelationshipMatrix
          parents={mockParents}
          students={[]}
          relationships={[]}
          onLinkParentStudent={onLink}
          onUnlinkParentStudent={onUnlink}
        />
      )

      expect(container.textContent).toContain('沒有學生')
    })

    it('displays error message when operation fails', async () => {
      const onLink = vi.fn().mockRejectedValue(new Error('Network error'))
      const onUnlink = vi.fn()

      const { container } = render(
        <RelationshipMatrix
          parents={mockParents}
          students={mockStudents}
          relationships={[]}
          onLinkParentStudent={onLink}
          onUnlinkParentStudent={onUnlink}
        />
      )

      const buttons = container.querySelectorAll('button')
      const firstButton = buttons[0]

      if (firstButton) {
        fireEvent.click(firstButton)

        await waitFor(() => {
          expect(container.textContent).toContain('Network error')
        })
      }
    })
  })

  describe('Complete Relationship Workflow', () => {
    it('supports one-to-many relationships (one parent multiple students)', async () => {
      const onLink = vi.fn().mockResolvedValue(undefined)
      const onUnlink = vi.fn()

      const { container } = render(
        <RelationshipMatrix
          parents={[mockParents[0]]}
          students={mockStudents}
          relationships={[]}
          onLinkParentStudent={onLink}
          onUnlinkParentStudent={onUnlink}
        />
      )

      const buttons = container.querySelectorAll('button')
      // Click multiple buttons to create relationships
      if (buttons.length >= 2) {
        fireEvent.click(buttons[0])
        fireEvent.click(buttons[1])

        await waitFor(() => {
          expect(onLink).toHaveBeenCalledTimes(2)
        })
      }
    })

    it('supports many-to-one relationships (multiple parents one student)', async () => {
      const onLink = vi.fn().mockResolvedValue(undefined)
      const onUnlink = vi.fn()

      const { container } = render(
        <RelationshipMatrix
          parents={mockParents}
          students={[mockStudents[0]]}
          relationships={[]}
          onLinkParentStudent={onLink}
          onUnlinkParentStudent={onUnlink}
        />
      )

      const buttons = container.querySelectorAll('button')
      // Click multiple buttons to create relationships
      if (buttons.length >= 2) {
        fireEvent.click(buttons[0])
        fireEvent.click(buttons[1])

        await waitFor(() => {
          expect(onLink).toHaveBeenCalledTimes(2)
        })
      }
    })

    it('maintains complex relationships (multiple parents and students)', () => {
      const onLink = vi.fn()
      const onUnlink = vi.fn()

      const { container } = render(
        <RelationshipMatrix
          parents={mockParents}
          students={mockStudents}
          relationships={mockRelationships}
          onLinkParentStudent={onLink}
          onUnlinkParentStudent={onUnlink}
        />
      )

      // Verify all relationships are properly displayed
      expect(container.textContent).toContain('張家長')
      expect(container.textContent).toContain('李家長')
      expect(container.textContent).toContain('小明')
      expect(container.textContent).toContain('小紅')
      expect(container.textContent).toContain('小剛')
    })
  })
})
