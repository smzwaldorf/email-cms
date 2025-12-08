import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ClassComparisonTable } from '@/components/analytics/ClassComparisonTable';
import { ClassEngagement } from '@/services/analyticsAggregator';

const mockData: ClassEngagement[] = [
    {
        className: 'Class A',
        activeUsers: 10,
        totalUsers: 20,
        openRate: 50,
        clickCount: 100,
        clickRate: 10,
        avgDailyTime: 120
    },
    {
        className: 'Class B',
        activeUsers: 5,
        totalUsers: 20,
        openRate: 25,
        clickCount: 20,
        clickRate: 4,
        avgDailyTime: 60
    }
];

describe('ClassComparisonTable', () => {
    it('renders correctly with data', () => {
        render(<ClassComparisonTable data={mockData} />);
        
        expect(screen.getByText('Class A')).toBeInTheDocument();
        expect(screen.getByText('Class B')).toBeInTheDocument();
        expect(screen.getByText('50.0%')).toBeInTheDocument();
        expect(screen.getByText('2m 0s')).toBeInTheDocument();
    });

    it('sorts data when clicking header', () => {
        render(<ClassComparisonTable data={mockData} />);
        
        // Initial order: desc by Open Rate (Class A first)
        const rows = screen.getAllByRole('row');
        // Row 0 is header, Row 1 is Class A, Row 2 is Class B
        expect(rows[1]).toHaveTextContent('Class A');
        
        // Click Open Rate header -> Ascending (Class B first)
        fireEvent.click(screen.getByText('Open Rate'));
        const sortedRows = screen.getAllByRole('row');
        expect(sortedRows[1]).toHaveTextContent('Class B');
    });

    it('renders empty state correctly', () => {
        render(<ClassComparisonTable data={[]} />);
        expect(screen.getByText('No class engagement data available.')).toBeInTheDocument();
    });
});
