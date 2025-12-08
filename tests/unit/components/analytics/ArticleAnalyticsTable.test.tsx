import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ArticleAnalyticsTable } from '@/components/analytics/ArticleAnalyticsTable';
import { BrowserRouter } from 'react-router-dom';

// Mock data
const mockArticles = [
  {
    id: 'a1',
    title: 'Alpha Article',
    publishedAt: '2025-01-01',
    views: 100,
    uniqueViews: 80,
    clicks: 10,
    avgTimeSpent: 60,
    avgTimeSpentFormatted: '1m 0s',
    hotnessScore: 80, // Hot
    avgReadLatencyMinutes: 30
  },
  {
    id: 'a2',
    title: 'Beta Article',
    publishedAt: '2025-01-02',
    views: 200,
    uniqueViews: 150,
    clicks: 20,
    avgTimeSpent: 120,
    avgTimeSpentFormatted: '2m 0s',
    hotnessScore: 50, // Warm
    avgReadLatencyMinutes: 60
  },
  {
    id: 'a3',
    title: 'Gamma Article',
    publishedAt: '2025-01-03',
    views: 50,
    uniqueViews: 40,
    clicks: 5,
    avgTimeSpent: 30,
    avgTimeSpentFormatted: '0m 30s',
    hotnessScore: 20, // Cold
    avgReadLatencyMinutes: 120
  },
  // Add more to test pagination (need > 10)
  ...Array.from({ length: 15 }).map((_, i) => ({
      id: `p${i}`,
      title: `Paginated Article ${i}`,
      publishedAt: '2025-01-04',
      views: 10 + i,
      uniqueViews: 5 + i,
      clicks: 1,
      avgTimeSpent: 10,
      avgTimeSpentFormatted: '0m 10s',
      hotnessScore: 10,
      avgReadLatencyMinutes: 60
  }))
];

const renderComponent = (data = mockArticles) => {
    return render(
        <BrowserRouter>
            <ArticleAnalyticsTable data={data} />
        </BrowserRouter>
    );
};

describe('ArticleAnalyticsTable', () => {
    it('renders the table with data', () => {
        renderComponent();
        expect(screen.getByText('Article Performance')).toBeInTheDocument();
        expect(screen.getByText('Alpha Article')).toBeInTheDocument();
        expect(screen.getByText('Beta Article')).toBeInTheDocument();
    });

    it('sorts data by Views by default (descending)', () => {
        renderComponent();
        // With default views desc sort: Beta (200) -> Alpha (100) -> Gamma (50) ...
        const rows = screen.getAllByRole('row');
        // Row 0 is header. Row 1+ are data.
        expect(rows[1]).toHaveTextContent('Beta Article');
        expect(rows[2]).toHaveTextContent('Alpha Article');
    });

    it('can sort by Title', () => {
        renderComponent();
        const titleHeader = screen.getByText('Article Title');
        
        // Click to sort (set to Title Descending first click if different field)
        fireEvent.click(titleHeader);
        
        // Click again for Ascending
        fireEvent.click(titleHeader);

        const rows = screen.getAllByRole('row');
        // Ascending: Alpha, Beta, Gamma...
        expect(rows[1]).toHaveTextContent('Alpha Article');
        expect(rows[2]).toHaveTextContent('Beta Article');
    });

    it('filters data by search term', () => {
        renderComponent();
        const searchInput = screen.getByPlaceholderText('Search articles...');
        
        fireEvent.change(searchInput, { target: { value: 'Beta' } });
        
        expect(screen.getByText('Beta Article')).toBeInTheDocument();
        expect(screen.queryByText('Alpha Article')).not.toBeInTheDocument();
    });

    it('paginates data (10 items per page)', () => {
        renderComponent();
        // Total 18 items. Page 1 should have 10.
        // Header + 10 rows = 11 rows.
        const rows = screen.getAllByRole('row');
        expect(rows).toHaveLength(11); 

        // Check for Pagination Controls
        expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();

        // Go to next page
        const nextBtn = screen.getByRole('button', { name: "Next Page" });
        fireEvent.click(nextBtn);
        
        expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
        
        const rows2 = screen.getAllByRole('row');
        // Header + 8 remaining items (total 18) = 9 rows
        expect(rows2).toHaveLength(9);
    });

    it('shows empty state when no data matches', () => {
        renderComponent([]);
        expect(screen.getByText('No articles found for this period.')).toBeInTheDocument();
    });
});
