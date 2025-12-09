/**
 * Analytics Export Service
 * Handles exporting analytics data in various formats (CSV, JSON, XLSX)
 */

export interface ExportData {
  metrics?: {
    openRate: number;
    clickRate: number;
    totalViews: number;
    avgTimeSpent: number;
    sentCount?: number;
    openCount?: number;
    clickCount?: number;
  };
  articles?: Array<{
    id: string;
    title: string;
    clicks: number;
    clickRate: number;
    avgTimeSpent: number;
    [key: string]: any;
  }>;
  classes?: Array<{
    id: string;
    name: string;
    sent: number;
    opens: number;
    clicks: number;
    openRate: number;
    clickRate: number;
    avgStayTime: number;
    [key: string]: any;
  }>;
  trends?: Array<{
    week: string;
    openRate: number;
    clickRate: number;
    [key: string]: any;
  }>;
  weekNumber?: string;
  exportDate?: string;
}

const downloadFile = (content: string | Blob, filename: string, mimeType: string) => {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatFilename = (format: string, weekNumber?: string) => {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  const weekStr = weekNumber ? `-${weekNumber}` : '';
  return `analytics-dashboard${weekStr}-${dateStr}.${format}`;
};

export const analyticsExportService = {
  /**
   * Export analytics data as CSV
   */
  async exportAsCSV(data: ExportData): Promise<void> {
    try {
      const rows: string[] = [];

      // Header
      rows.push('Analytics Dashboard Export');
      rows.push(`Exported: ${new Date().toISOString()}`);
      if (data.weekNumber) {
        rows.push(`Week: ${data.weekNumber}`);
      }
      rows.push('');

      // Metrics section
      if (data.metrics) {
        rows.push('METRICS');
        rows.push('Metric,Value');
        rows.push(`Open Rate,${data.metrics.openRate.toFixed(2)}%`);
        rows.push(`Click Rate,${data.metrics.clickRate.toFixed(2)}%`);
        rows.push(`Total Views,${data.metrics.totalViews}`);
        rows.push(`Avg Time Spent,${data.metrics.avgTimeSpent || 0}s`);
        if (data.metrics.sentCount !== undefined) {
          rows.push(`Sent Count,${data.metrics.sentCount}`);
        }
        if (data.metrics.openCount !== undefined) {
          rows.push(`Open Count,${data.metrics.openCount}`);
        }
        if (data.metrics.clickCount !== undefined) {
          rows.push(`Click Count,${data.metrics.clickCount}`);
        }
        rows.push('');
      }

      // Articles section
      if (data.articles && data.articles.length > 0) {
        rows.push('ARTICLES');
        rows.push('Title,Clicks,Click Rate,Avg Time Spent (s)');
        data.articles.forEach(article => {
          const escapedTitle = `"${article.title.replace(/"/g, '""')}"`;
          rows.push(
            `${escapedTitle},${article.clicks},${article.clickRate.toFixed(2)}%,${article.avgTimeSpent || 0}`
          );
        });
        rows.push('');
      }

      // Classes section
      if (data.classes && data.classes.length > 0) {
        rows.push('CLASSES');
        rows.push('Name,Sent,Opens,Clicks,Open Rate,Click Rate,Avg Stay Time (s)');
        data.classes.forEach(cls => {
          rows.push(
            `${cls.name},${cls.sent},${cls.opens},${cls.clicks},${cls.openRate.toFixed(2)}%,${cls.clickRate.toFixed(2)}%,${cls.avgStayTime || 0}`
          );
        });
        rows.push('');
      }

      // Trends section
      if (data.trends && data.trends.length > 0) {
        rows.push('TRENDS (Last 12 Weeks)');
        rows.push('Week,Open Rate,Click Rate');
        data.trends.forEach(trend => {
          rows.push(`${trend.week},${trend.openRate.toFixed(2)}%,${trend.clickRate.toFixed(2)}%`);
        });
      }

      const csv = rows.join('\n');
      const filename = formatFilename('csv', data.weekNumber);
      downloadFile(csv, filename, 'text/csv;charset=utf-8;');
    } catch (error) {
      console.error('CSV export failed:', error);
      throw new Error('Failed to export as CSV');
    }
  },

  /**
   * Export analytics data as JSON
   */
  async exportAsJSON(data: ExportData): Promise<void> {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        weekNumber: data.weekNumber,
        ...data
      };

      const json = JSON.stringify(exportData, null, 2);
      const filename = formatFilename('json', data.weekNumber);
      downloadFile(json, filename, 'application/json;charset=utf-8;');
    } catch (error) {
      console.error('JSON export failed:', error);
      throw new Error('Failed to export as JSON');
    }
  },

  /**
   * Export analytics data as XLSX (Excel)
   * Requires exceljs library or creates a CSV-based approach
   */
  async exportAsXLSX(data: ExportData): Promise<void> {
    try {
      // For now, fallback to CSV export
      // In production, this would use exceljs library
      console.warn('XLSX export not yet fully implemented, using CSV fallback');
      return this.exportAsCSV(data);

      /*
      // Full XLSX implementation (requires exceljs)
      let ExcelJS: any;
      try {
        const excelModule = require('exceljs');
        ExcelJS = excelModule.default || excelModule;
      } catch (e) {
        console.warn('exceljs not available, falling back to CSV export');
        return this.exportAsCSV(data);
      }

      const workbook = new ExcelJS.Workbook();

      // Summary Sheet
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.columns = [{ header: 'Metric', key: 'metric', width: 30 }, { header: 'Value', key: 'value', width: 15 }];

      if (data.metrics) {
        summarySheet.addRow({
          metric: 'Open Rate',
          value: `${data.metrics.openRate.toFixed(2)}%`
        });
        summarySheet.addRow({
          metric: 'Click Rate',
          value: `${data.metrics.clickRate.toFixed(2)}%`
        });
        summarySheet.addRow({ metric: 'Total Views', value: data.metrics.totalViews });
        summarySheet.addRow({ metric: 'Avg Time Spent', value: `${data.metrics.avgTimeSpent || 0}s` });
      }

      summarySheet.addRow({ metric: 'Export Date', value: new Date().toISOString() });
      if (data.weekNumber) {
        summarySheet.addRow({ metric: 'Week', value: data.weekNumber });
      }

      // Articles Sheet
      if (data.articles && data.articles.length > 0) {
        const articlesSheet = workbook.addWorksheet('Articles');
        articlesSheet.columns = [
          { header: 'Title', key: 'title', width: 40 },
          { header: 'Clicks', key: 'clicks', width: 12 },
          { header: 'Click Rate', key: 'clickRate', width: 12 },
          { header: 'Avg Time Spent (s)', key: 'avgTimeSpent', width: 15 }
        ];

        data.articles.forEach(article => {
          articlesSheet.addRow({
            title: article.title,
            clicks: article.clicks,
            clickRate: `${article.clickRate.toFixed(2)}%`,
            avgTimeSpent: article.avgTimeSpent || 0
          });
        });
      }

      // Classes Sheet
      if (data.classes && data.classes.length > 0) {
        const classesSheet = workbook.addWorksheet('Classes');
        classesSheet.columns = [
          { header: 'Name', key: 'name', width: 20 },
          { header: 'Sent', key: 'sent', width: 10 },
          { header: 'Opens', key: 'opens', width: 10 },
          { header: 'Clicks', key: 'clicks', width: 10 },
          { header: 'Open Rate', key: 'openRate', width: 12 },
          { header: 'Click Rate', key: 'clickRate', width: 12 },
          { header: 'Avg Stay Time (s)', key: 'avgStayTime', width: 15 }
        ];

        data.classes.forEach(cls => {
          classesSheet.addRow({
            name: cls.name,
            sent: cls.sent,
            opens: cls.opens,
            clicks: cls.clicks,
            openRate: `${cls.openRate.toFixed(2)}%`,
            clickRate: `${cls.clickRate.toFixed(2)}%`,
            avgStayTime: cls.avgStayTime || 0
          });
        });
      }

      // Trends Sheet
      if (data.trends && data.trends.length > 0) {
        const trendsSheet = workbook.addWorksheet('Trends');
        trendsSheet.columns = [
          { header: 'Week', key: 'week', width: 15 },
          { header: 'Open Rate', key: 'openRate', width: 12 },
          { header: 'Click Rate', key: 'clickRate', width: 12 }
        ];

        data.trends.forEach(trend => {
          trendsSheet.addRow({
            week: trend.week,
            openRate: `${trend.openRate.toFixed(2)}%`,
            clickRate: `${trend.clickRate.toFixed(2)}%`
          });
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = formatFilename('xlsx', data.weekNumber);
      downloadFile(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      */
    } catch (error) {
      console.error('XLSX export failed:', error);
      // Fallback to CSV
      console.warn('Falling back to CSV export');
      await this.exportAsCSV(data);
    }
  },

  /**
   * Format metrics for export
   */
  formatMetricsForExport(metrics: any): ExportData['metrics'] {
    return {
      openRate: metrics?.openRate || 0,
      clickRate: metrics?.clickRate || 0,
      totalViews: metrics?.totalViews || 0,
      avgTimeSpent: metrics?.avgTimeSpent || 0,
      sentCount: metrics?.sentCount,
      openCount: metrics?.openCount,
      clickCount: metrics?.clickCount
    };
  },

  /**
   * Format articles for export
   */
  formatArticlesForExport(articles: any[]): ExportData['articles'] {
    return articles.map(article => ({
      id: article.id,
      title: article.title || 'Untitled',
      clicks: article.clicks || 0,
      clickRate: article.clickRate || 0,
      avgTimeSpent: article.avgTimeSpent || 0
    }));
  },

  /**
   * Format classes for export
   */
  formatClassesForExport(classes: any[]): ExportData['classes'] {
    return classes.map(cls => ({
      id: cls.id,
      name: cls.name || 'Unknown',
      sent: cls.sent || 0,
      opens: cls.opens || 0,
      clicks: cls.clicks || 0,
      openRate: cls.openRate || 0,
      clickRate: cls.clickRate || 0,
      avgStayTime: cls.avgStayTime || 0
    }));
  }
};
