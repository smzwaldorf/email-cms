import React, { useState } from 'react';
import { Download, ChevronDown, FileJson, Table, Sheet } from 'lucide-react';

export interface ExportFormat {
  type: 'csv' | 'json' | 'xlsx';
  label: string;
  icon: React.ReactNode;
  description: string;
}

export interface ExportButtonProps {
  onExport: (format: 'csv' | 'json' | 'xlsx') => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  onExport,
  isLoading = false,
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFormat, setActiveFormat] = useState<'csv' | 'json' | 'xlsx' | null>(null);

  const formats: ExportFormat[] = [
    {
      type: 'csv',
      label: 'CSV',
      icon: <Table className="w-4 h-4" />,
      description: 'Spreadsheet compatible'
    },
    {
      type: 'json',
      label: 'JSON',
      icon: <FileJson className="w-4 h-4" />,
      description: 'Structured data format'
    },
    {
      type: 'xlsx',
      label: 'Excel',
      icon: <Sheet className="w-4 h-4" />,
      description: 'Multiple sheets'
    }
  ];

  const handleExport = async (format: 'csv' | 'json' | 'xlsx') => {
    try {
      setActiveFormat(format);
      await onExport(format);
      setIsOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setActiveFormat(null);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-neutral-200 rounded-lg text-sm font-medium text-brand-neutral-700 hover:bg-brand-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export analytics data"
      >
        <Download className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        <span>Export</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-brand-neutral-200 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-brand-neutral-100">
            <p className="text-xs font-semibold text-brand-neutral-600 uppercase tracking-wide">
              Export Format
            </p>
          </div>

          <div className="divide-y divide-brand-neutral-100">
            {formats.map((format) => (
              <button
                key={format.type}
                onClick={() => handleExport(format.type)}
                disabled={isLoading}
                className="w-full px-4 py-3 text-left hover:bg-brand-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="text-brand-neutral-400 group-hover:text-brand-primary transition-colors">
                    {format.icon}
                  </div>
                  <div>
                    <p className="font-medium text-brand-neutral-800">
                      {activeFormat === format.type && isLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                          Exporting...
                        </span>
                      ) : (
                        format.label
                      )}
                    </p>
                    <p className="text-xs text-brand-neutral-500">{format.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="p-3 bg-brand-neutral-50 border-t border-brand-neutral-100">
            <p className="text-xs text-brand-neutral-500">
              File will include current dashboard view
            </p>
          </div>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
