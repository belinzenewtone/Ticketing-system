'use client';

import { useQuery } from '@tanstack/react-query';
import { getEntryStats, getEntries } from '@/services/entries';
import { getTaskStats, getTasks } from '@/services/tasks';
import { getMachineStats, getMachines } from '@/services/machines';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FileDown, Mail, CheckSquare, Monitor } from 'lucide-react';
import { useState } from 'react';

type ReportType = 'entries' | 'tasks' | 'machines';
type DateRange = 'today' | 'week' | 'month' | 'year';

export default function ReportsPage() {
    const [reportType, setReportType] = useState<ReportType>('entries');
    const [dateRange, setDateRange] = useState<DateRange>('month');
    const [generating, setGenerating] = useState(false);

    const { data: entryStats } = useQuery({ queryKey: ['entry-stats'], queryFn: getEntryStats });
    const { data: taskStats } = useQuery({ queryKey: ['task-stats'], queryFn: getTaskStats });
    const { data: machineStats } = useQuery({ queryKey: ['machine-stats'], queryFn: getMachineStats });

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const { default: jsPDF } = await import('jspdf');
            const autoTableModule = await import('jspdf-autotable');
            const doc = new jsPDF();

            doc.setFontSize(18);
            doc.setTextColor(16, 185, 129);
            doc.text('Ticketing System', 14, 22);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Report: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} | Period: ${dateRange}`, 14, 30);
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 36);

            if (reportType === 'entries') {
                const entries = await getEntries({ dateRange });
                (autoTableModule as { default: (doc: InstanceType<typeof jsPDF>, opts: Record<string, unknown>) => void }).default(doc, {
                    startY: 44,
                    head: [['#', 'Date', 'Employee', 'Work Email', 'Resolution', 'Completed']],
                    body: entries.map(e => [e.number, e.entry_date, e.employee_name, e.work_email, e.resolution, e.completed ? 'Yes' : 'No']),
                    theme: 'grid',
                    headStyles: { fillColor: [16, 185, 129] },
                });
            } else if (reportType === 'tasks') {
                const tasks = await getTasks();
                (autoTableModule as { default: (doc: InstanceType<typeof jsPDF>, opts: Record<string, unknown>) => void }).default(doc, {
                    startY: 44,
                    head: [['Date', 'Task', 'Priority', 'Completed']],
                    body: tasks.map(t => [t.date, t.text, t.importance, t.completed ? 'Yes' : 'No']),
                    theme: 'grid',
                    headStyles: { fillColor: [16, 185, 129] },
                });
            } else {
                const machines = await getMachines();
                (autoTableModule as { default: (doc: InstanceType<typeof jsPDF>, opts: Record<string, unknown>) => void }).default(doc, {
                    startY: 44,
                    head: [['#', 'Date', 'Requester', 'User', 'Reason', 'Status']],
                    body: machines.map(m => [m.number, m.date, m.requester_name, m.user_name, m.reason, m.status]),
                    theme: 'grid',
                    headStyles: { fillColor: [16, 185, 129] },
                });
            }

            doc.save(`${reportType}_report_${dateRange}.pdf`);
        } catch {
            let csv = '';
            if (reportType === 'entries') {
                const entries = await getEntries({ dateRange });
                csv = 'Number,Date,Employee,Email,Resolution,Completed\n';
                csv += entries.map(e => `${e.number},${e.entry_date},${e.employee_name},${e.work_email},${e.resolution},${e.completed}`).join('\n');
            } else if (reportType === 'tasks') {
                const tasks = await getTasks();
                csv = 'Date,Task,Priority,Completed\n';
                csv += tasks.map(t => `${t.date},"${t.text}",${t.importance},${t.completed}`).join('\n');
            } else {
                const machines = await getMachines();
                csv = 'Number,Date,Requester,User,Reason,Status\n';
                csv += machines.map(m => `${m.number},${m.date},${m.requester_name},${m.user_name},${m.reason},${m.status}`).join('\n');
            }

            const blob = new Blob([csv], { type: 'text/csv' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${reportType}_report_${dateRange}.csv`;
            link.click();
        } finally {
            setGenerating(false);
        }
    };

    const summaryCards = [
        { label: 'Email Entries', value: entryStats?.total ?? 0, sub: `${entryStats?.sorted ?? 0} sorted`, icon: Mail, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Tasks', value: taskStats?.total ?? 0, sub: `${taskStats?.completed ?? 0} completed`, icon: CheckSquare, color: 'text-teal-500', bg: 'bg-teal-500/10' },
        { label: 'Machine Requests', value: machineStats?.total ?? 0, sub: `${machineStats?.fulfilled ?? 0} fulfilled`, icon: Monitor, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">📊 Reports</h1>
                <p className="text-muted-foreground mt-1">Generate and export data reports</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {summaryCards.map((c) => (
                    <Card key={c.label} className="border shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                            <div className={`p-2 rounded-lg ${c.bg}`}><c.icon className={`h-5 w-5 ${c.color}`} /></div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold text-foreground">{c.value}</p>
                            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="border shadow-sm">
                <CardHeader>
                    <CardTitle className="text-foreground">Generate Report</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm text-muted-foreground">Report Type</label>
                            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="entries">📧 Email Entries</SelectItem>
                                    <SelectItem value="tasks">📝 Tasks</SelectItem>
                                    <SelectItem value="machines">💻 Machine Requests</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-muted-foreground">Time Period</label>
                            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="today">Today</SelectItem>
                                    <SelectItem value="week">This Week</SelectItem>
                                    <SelectItem value="month">This Month</SelectItem>
                                    <SelectItem value="year">This Year</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                    >
                        <FileDown className="h-4 w-4 mr-2" />
                        {generating ? 'Generating...' : 'Download Report'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
