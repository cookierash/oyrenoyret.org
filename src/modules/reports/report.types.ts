/**
 * Report Types
 * 
 * TypeScript type definitions for the reports domain module.
 */

export type ReportType = 'PROGRESS' | 'PERFORMANCE' | 'ATTENDANCE' | 'COMPREHENSIVE';

export interface AcademicReport {
  id: string;
  userId: string;
  reportType: ReportType;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
