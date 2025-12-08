import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AnalyticsState {
    selectedWeek: string;
    selectedClass: string;
    timeRange: '4' | '12';
    classViewMode: 'table' | 'chart';
    hasBeenHidden: boolean;
}

interface AnalyticsContextType extends AnalyticsState {
    setSelectedWeek: (week: string) => void;
    setSelectedClass: (cls: string) => void;
    setTimeRange: (range: '4' | '12') => void;
    setClassViewMode: (mode: 'table' | 'chart') => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function AnalyticsProvider({ children }: { children: ReactNode }) {
    const [selectedWeek, setSelectedWeek] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [timeRange, setTimeRange] = useState<'4' | '12'>('12');
    const [classViewMode, setClassViewMode] = useState<'table' | 'chart'>('table');
    const [hasBeenHidden, setHasBeenHidden] = useState(false);

    React.useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                setHasBeenHidden(true);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    return (
        <AnalyticsContext.Provider value={{
            selectedWeek,
            setSelectedWeek,
            selectedClass,
            setSelectedClass,
            timeRange,
            setTimeRange,
            classViewMode,
            setClassViewMode,
            hasBeenHidden
        }}>
            {children}
        </AnalyticsContext.Provider>
    );
}

export function useAnalytics() {
    const context = useContext(AnalyticsContext);
    if (!context) {
        throw new Error('useAnalytics must be used within an AnalyticsProvider');
    }
    return context;
}
