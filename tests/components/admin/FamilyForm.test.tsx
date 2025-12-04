/**
 * Test - Family Form Component (Admin)
 * T040: Family form unit tests with topic management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FamilyForm from '@/components/admin/FamilyForm'
import type { Family } from '@/types/admin'

describe('FamilyForm', () => {
  const mockFamily: Family = {
    id: 'family-001',
    name: '升學進路',
    description: '關於升學進路的文章集合',
    relatedTopics: ['大學選擇', '科系介紹', '準備方向'],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  }

  /**
   * Test: Render new family form
   */
  it('should render new family form with empty fields', () => {
    const onCancel = vi.fn()
    render(<FamilyForm isNew={true} onCancel={onCancel} />)

    expect(screen.getByText('新增家族')).toBeInTheDocument()
    expect(screen.getByTestId('name-input')).toHaveValue('')
    expect(screen.getByTestId('description-input')).toHaveValue('')
  })

  /**
   * Test: Render edit family form
   */
  it('should render edit family form with populated fields', () => {
    const onCancel = vi.fn()
    render(<FamilyForm family={mockFamily} isNew={false} onCancel={onCancel} />)

    expect(screen.getByText('編輯家族')).toBeInTheDocument()
    expect(screen.getByTestId('name-input')).toHaveValue('升學進路')
    expect(screen.getByTestId('description-input')).toHaveValue('關於升學進路的文章集合')
  })

  /**
   * Test: Validate required name field
   */
  it('should show validation error when name is empty', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(<FamilyForm isNew={true} onSave={onSave} onCancel={onCancel} />)

    const saveBtn = screen.getByTestId('save-btn')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByTestId('name-error')).toBeInTheDocument()
      expect(screen.getByTestId('name-error')).toHaveTextContent('家族名稱為必填項')
      expect(onSave).not.toHaveBeenCalled()
    })
  })

  /**
   * Test: Update name field
   */
  it('should update name field and clear validation error', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<FamilyForm isNew={true} onCancel={onCancel} />)

    const nameInput = screen.getByTestId('name-input') as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, '親子教育')

    expect(nameInput.value).toBe('親子教育')
    expect(screen.queryByTestId('name-error')).not.toBeInTheDocument()
  })

  /**
   * Test: Update description field
   */
  it('should update description field', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<FamilyForm family={mockFamily} isNew={false} onCancel={onCancel} />)

    const descInput = screen.getByTestId('description-input') as HTMLTextAreaElement
    await user.clear(descInput)
    await user.type(descInput, '親子互動和教育方法')

    expect(descInput.value).toBe('親子互動和教育方法')
  })

  /**
   * Test: Add topic
   */
  it('should add topic when Enter key is pressed', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<FamilyForm isNew={true} onCancel={onCancel} />)

    const topicInput = screen.getByTestId('topic-input') as HTMLInputElement
    await user.type(topicInput, '家庭教育')
    await user.keyboard('{Enter}')

    expect(screen.getByTestId('topic-tag-0')).toBeInTheDocument()
    expect(screen.getByTestId('topic-tag-0')).toHaveTextContent('家庭教育')
    expect(topicInput.value).toBe('')
  })

  /**
   * Test: Add topic with button click
   */
  it('should add topic when add button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<FamilyForm isNew={true} onCancel={onCancel} />)

    const topicInput = screen.getByTestId('topic-input') as HTMLInputElement
    const addBtn = screen.getByTestId('add-topic-btn')

    await user.type(topicInput, '溝通技巧')
    await user.click(addBtn)

    expect(screen.getByTestId('topic-tag-0')).toBeInTheDocument()
    expect(screen.getByTestId('topic-tag-0')).toHaveTextContent('溝通技巧')
  })

  /**
   * Test: Remove topic
   */
  it('should remove topic when remove button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<FamilyForm family={mockFamily} isNew={false} onCancel={onCancel} />)

    // Family has 3 topics, should show all
    expect(screen.getByTestId('topic-tag-0')).toBeInTheDocument()
    expect(screen.getByTestId('topic-tag-1')).toBeInTheDocument()
    expect(screen.getByTestId('topic-tag-2')).toBeInTheDocument()

    // Remove first topic (大學選擇)
    const removeBtns = screen.getAllByTestId(/^remove-topic-btn-/)
    await user.click(removeBtns[0])

    await waitFor(() => {
      // After removing first topic, second becomes first
      const remaining = screen.queryAllByTestId(/^topic-tag-/)
      expect(remaining.length).toBe(2)
    })
  })

  /**
   * Test: Prevent duplicate topics
   */
  it('should prevent adding duplicate topics', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<FamilyForm isNew={true} onCancel={onCancel} />)

    const topicInput = screen.getByTestId('topic-input') as HTMLInputElement
    const addBtn = screen.getByTestId('add-topic-btn')

    // Add first topic
    await user.type(topicInput, '教育方法')
    await user.click(addBtn)
    expect(screen.getByTestId('topic-tag-0')).toBeInTheDocument()

    // Try to add same topic
    await user.type(topicInput, '教育方法')
    await user.click(addBtn)

    // Should still have only 1 topic
    expect(screen.queryByTestId('topic-tag-1')).not.toBeInTheDocument()
  })

  /**
   * Test: Display pre-loaded topics in edit mode
   */
  it('should display pre-loaded topics in edit mode', () => {
    const onCancel = vi.fn()

    render(<FamilyForm family={mockFamily} isNew={false} onCancel={onCancel} />)

    expect(screen.getByTestId('topic-tag-0')).toHaveTextContent('大學選擇')
    expect(screen.getByTestId('topic-tag-1')).toHaveTextContent('科系介紹')
    expect(screen.getByTestId('topic-tag-2')).toHaveTextContent('準備方向')
  })

  /**
   * Test: Save button functionality
   */
  it('should call onSave with family data when form is valid', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(<FamilyForm isNew={true} onSave={onSave} onCancel={onCancel} />)

    // Fill in form
    const nameInput = screen.getByTestId('name-input')
    await user.type(nameInput, '新家族')

    const descInput = screen.getByTestId('description-input')
    await user.type(descInput, '新家族描述')

    // Add topic
    const topicInput = screen.getByTestId('topic-input')
    const addBtn = screen.getByTestId('add-topic-btn')
    await user.type(topicInput, '主題1')
    await user.click(addBtn)

    // Save
    const saveBtn = screen.getByTestId('save-btn')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled()
      const savedFamily = onSave.mock.calls[0][0]
      expect(savedFamily.name).toBe('新家族')
      expect(savedFamily.description).toBe('新家族描述')
      expect(savedFamily.relatedTopics).toContain('主題1')
    })
  })

  /**
   * Test: Cancel button functionality
   */
  it('should call onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<FamilyForm isNew={true} onCancel={onCancel} />)

    const cancelBtn = screen.getByTestId('cancel-btn')
    await user.click(cancelBtn)

    expect(onCancel).toHaveBeenCalled()
  })

  /**
   * Test: Topic count display
   */
  it('should display correct topic count', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<FamilyForm isNew={true} onCancel={onCancel} />)

    // Initial count
    expect(screen.getByText('相關主題 (0)')).toBeInTheDocument()

    // Add topics
    const topicInput = screen.getByTestId('topic-input') as HTMLInputElement
    const addBtn = screen.getByTestId('add-topic-btn')

    await user.type(topicInput, '主題1')
    await user.click(addBtn)
    expect(screen.getByText('相關主題 (1)')).toBeInTheDocument()

    await user.type(topicInput, '主題2')
    await user.click(addBtn)
    expect(screen.getByText('相關主題 (2)')).toBeInTheDocument()

    await user.type(topicInput, '主題3')
    await user.click(addBtn)
    expect(screen.getByText('相關主題 (3)')).toBeInTheDocument()
  })

  /**
   * Test: Ignore whitespace in topic input
   */
  it('should ignore whitespace-only topic input', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<FamilyForm isNew={true} onCancel={onCancel} />)

    const topicInput = screen.getByTestId('topic-input') as HTMLInputElement
    const addBtn = screen.getByTestId('add-topic-btn')

    // Try to add only spaces
    await user.type(topicInput, '   ')
    await user.click(addBtn)

    // Should not add
    expect(screen.queryByTestId('topic-tag-0')).not.toBeInTheDocument()
    // Input should be cleared
    await waitFor(() => {
      expect(topicInput.value).toBe('')
    })
  })

  /**
   * Test: Empty family with no topics
   */
  it('should handle family with no related topics', () => {
    const emptyFamily: Family = {
      id: 'family-002',
      name: '新家族',
      description: '描述',
      relatedTopics: [],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }
    const onCancel = vi.fn()

    render(<FamilyForm family={emptyFamily} isNew={false} onCancel={onCancel} />)

    expect(screen.getByText('相關主題 (0)')).toBeInTheDocument()
    expect(screen.queryByTestId('topic-tag-0')).not.toBeInTheDocument()
  })
})
