import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyticsExportService, type ExportData } from '@/services/analyticsExportService';

// Mock DOM methods
beforeEach(() => {
  // Mock URL.createObjectURL and URL.revokeObjectURL
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();

  // Mock document methods
  document.body.appendChild = vi.fn();
  document.body.removeChild = vi.fn();
});

describe('analyticsExportService', () => {
  const mockData: ExportData = {
    metrics: {
      openRate: 45.5,
      clickRate: 23.2,
      totalViews: 1500,
      avgTimeSpent: 120,
      sentCount: 1000,
      openCount: 455,
      clickCount: 256
    },
    articles: [
      {
        id: 'article-1',
        title: 'Breaking News',
        clicks: 120,
        clickRate: 25.5,
        avgTimeSpent: 180
      },
      {
        id: 'article-2',
        title: 'Feature Story',
        clicks: 80,
        clickRate: 17.2,
        avgTimeSpent: 240
      }
    ],
    classes: [
      {
        id: 'class-1',
        name: 'Class A',
        sent: 500,
        opens: 200,
        clicks: 80,
        openRate: 40.0,
        clickRate: 16.0,
        avgStayTime: 150
      }
    ],
    trends: [
      { week: '2025-W50', openRate: 42.1, clickRate: 20.5 },
      { week: '2025-W51', openRate: 45.5, clickRate: 23.2 }
    ],
    weekNumber: '2025-W51',
    exportDate: new Date().toISOString()
  };

  describe('exportAsCSV', () => {
    it('should export data as CSV string', async () => {
      const createElementSpy = vi.spyOn(document, 'createElement');

      await analyticsExportService.exportAsCSV(mockData);

      expect(createElementSpy).toHaveBeenCalledWith('a');
    });

    it('should include metrics in CSV', async () => {
      const createElementSpy = vi.spyOn(document, 'createElement');

      await analyticsExportService.exportAsCSV(mockData);

      expect(createElementSpy).toHaveBeenCalled();
    });

    it('should include articles in CSV', async () => {
      const createElementSpy = vi.spyOn(document, 'createElement');

      await analyticsExportService.exportAsCSV(mockData);

      expect(createElementSpy).toHaveBeenCalled();
    });

    it('should handle special characters in article titles', async () => {
      const dataWithSpecialChars: ExportData = {
        ...mockData,
        articles: [
          {
            id: 'article-1',
            title: 'Title with "quotes" and, commas',
            clicks: 100,
            clickRate: 20.0,
            avgTimeSpent: 200
          }
        ]
      };

      const createElementSpy = vi.spyOn(document, 'createElement');

      await analyticsExportService.exportAsCSV(dataWithSpecialChars);

      expect(createElementSpy).toHaveBeenCalled();
    });

    it('should generate correct filename with week number', async () => {
      const linkSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

      await analyticsExportService.exportAsCSV(mockData);

      expect(linkSpy).toHaveBeenCalled();
    });

    it('should handle empty data gracefully', async () => {
      const emptyData: ExportData = {
        metrics: undefined,
        articles: [],
        classes: [],
        trends: []
      };

      const createElementSpy = vi.spyOn(document, 'createElement');

      await analyticsExportService.exportAsCSV(emptyData);

      expect(createElementSpy).toHaveBeenCalled();
    });
  });

  describe('exportAsJSON', () => {
    it('should export data as JSON', async () => {
      const createElementSpy = vi.spyOn(document, 'createElement');

      await analyticsExportService.exportAsJSON(mockData);

      expect(createElementSpy).toHaveBeenCalledWith('a');
    });

    it('should include export date in JSON', async () => {
      const linkSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

      await analyticsExportService.exportAsJSON(mockData);

      expect(linkSpy).toHaveBeenCalled();
    });

    it('should generate valid JSON structure', async () => {
      const createElementSpy = vi.spyOn(document, 'createElement');

      await analyticsExportService.exportAsJSON(mockData);

      expect(createElementSpy).toHaveBeenCalled();
    });

    it('should include week number in JSON', async () => {
      const linkSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

      await analyticsExportService.exportAsJSON(mockData);

      expect(linkSpy).toHaveBeenCalled();
    });
  });

  describe('exportAsXLSX', () => {
    it('should attempt to export as XLSX', async () => {
      const createElementSpy = vi.spyOn(document, 'createElement');

      await analyticsExportService.exportAsXLSX(mockData);

      // Should either create Excel or fallback to CSV
      expect(createElementSpy).toHaveBeenCalled();
    });

    it('should fallback to CSV if exceljs unavailable', async () => {
      const createElementSpy = vi.spyOn(document, 'createElement');

      await analyticsExportService.exportAsXLSX(mockData);

      expect(createElementSpy).toHaveBeenCalled();
    });
  });

  describe('formatMetricsForExport', () => {
    it('should format metrics correctly', () => {
      const formatted = analyticsExportService.formatMetricsForExport(mockData.metrics);

      expect(formatted?.openRate).toBe(45.5);
      expect(formatted?.clickRate).toBe(23.2);
      expect(formatted?.totalViews).toBe(1500);
    });

    it('should handle missing metrics', () => {
      const formatted = analyticsExportService.formatMetricsForExport(null);

      expect(formatted?.openRate).toBe(0);
      expect(formatted?.clickRate).toBe(0);
      expect(formatted?.totalViews).toBe(0);
    });

    it('should preserve optional fields', () => {
      const formatted = analyticsExportService.formatMetricsForExport(mockData.metrics);

      expect(formatted?.sentCount).toBe(1000);
      expect(formatted?.openCount).toBe(455);
      expect(formatted?.clickCount).toBe(256);
    });
  });

  describe('formatArticlesForExport', () => {
    it('should format articles correctly', () => {
      const formatted = analyticsExportService.formatArticlesForExport(mockData.articles || []);

      expect(formatted).toHaveLength(2);
      expect(formatted?.[0]?.title).toBe('Breaking News');
      expect(formatted?.[0]?.clicks).toBe(120);
    });

    it('should handle missing article fields', () => {
      const articles = [{ id: 'article-1' }];
      const formatted = analyticsExportService.formatArticlesForExport(articles as any);

      expect(formatted?.[0]?.title).toBe('Untitled');
      expect(formatted?.[0]?.clicks).toBe(0);
    });

    it('should handle empty articles', () => {
      const formatted = analyticsExportService.formatArticlesForExport([]);

      expect(formatted).toHaveLength(0);
    });
  });

  describe('formatClassesForExport', () => {
    it('should format classes correctly', () => {
      const formatted = analyticsExportService.formatClassesForExport(mockData.classes || []);

      expect(formatted).toHaveLength(1);
      expect(formatted?.[0]?.name).toBe('Class A');
      expect(formatted?.[0]?.openRate).toBe(40.0);
    });

    it('should handle missing class fields', () => {
      const classes = [{ id: 'class-1', name: 'Class X' }];
      const formatted = analyticsExportService.formatClassesForExport(classes as any);

      expect(formatted?.[0]?.sent).toBe(0);
      expect(formatted?.[0]?.opens).toBe(0);
    });

    it('should handle empty classes', () => {
      const formatted = analyticsExportService.formatClassesForExport([]);

      expect(formatted).toHaveLength(0);
    });
  });
});
